import Hls from 'hls.js'
import { startTransition, useEffect } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

import { EntityUUID } from '@xrengine/common/src/interfaces/EntityUUID'
import { getState, none, useHookstate } from '@xrengine/hyperflux'

import { AssetLoader } from '../../assets/classes/AssetLoader'
import { removePannerNode } from '../../audio/systems/PositionalAudioSystem'
import { deepEqual } from '../../common/functions/deepEqual'
import { isClient } from '../../common/functions/isClient'
import { Engine } from '../../ecs/classes/Engine'
import { EngineState } from '../../ecs/classes/EngineState'
import { Entity } from '../../ecs/classes/Entity'
import {
  ComponentType,
  defineComponent,
  getComponentState,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  setComponent,
  useComponent,
  useOptionalComponent
} from '../../ecs/functions/ComponentFunctions'
import { EntityReactorProps } from '../../ecs/functions/EntityFunctions'
import { EngineRendererState } from '../../renderer/EngineRendererState'
import { ObjectLayers } from '../constants/ObjectLayers'
import { PlayMode } from '../constants/PlayMode'
import { addError, clearErrors, removeError } from '../functions/ErrorFunctions'
import isHLS from '../functions/isHLS'
import { setObjectLayers } from '../functions/setObjectLayers'
import { addObjectToGroup, removeObjectFromGroup } from './GroupComponent'

const AUDIO_TEXTURE_PATH = '/static/editor/audio-icon.png'

export const AudioNodeGroups = new WeakMap<HTMLMediaElement | MediaStream, AudioNodeGroup>()

export type MediaResource = {
  path: string
  mediaType: 'audio' | 'video' | 'volumetric'
  id?: EntityUUID
}

export type AudioNodeGroup = {
  source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode
  gain: GainNode
  panner?: PannerNode
  mixbus: GainNode
}

export const createAudioNodeGroup = (
  el: HTMLMediaElement | MediaStream,
  source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode,
  mixbus: GainNode
) => {
  const gain = Engine.instance.audioContext.createGain()
  source.connect(gain)
  gain.connect(mixbus)
  const panner = Engine.instance.audioContext.createPanner()
  const group = { source, gain, mixbus, panner } as AudioNodeGroup
  AudioNodeGroups.set(el, group)
  return group
}

export const MediaElementComponent = defineComponent({
  name: 'MediaElement',

  onInit: (entity) => {
    return {
      element: undefined! as HTMLMediaElement,
      hls: undefined as Hls | undefined,
      abortController: new AbortController()
    }
  },

  toJSON: () => {
    return undefined as any as { element: HTMLMediaElement }
  },

  onSet: (entity, component, json) => {
    console.log('mediaelement onset', json)
    if (!json) return
    if (typeof json.element === 'object' && json.element !== component.element.get({ noproxy: true }))
      component.element.set(json.element as HTMLMediaElement)
  },

  onRemove: (entity, component) => {
    const element = component.element.get({ noproxy: true })
    component.hls.value?.destroy()
    component.hls.set(none)
    const audioNodeGroup = AudioNodeGroups.get(element)
    if (audioNodeGroup && audioNodeGroup.panner) removePannerNode(audioNodeGroup)
    AudioNodeGroups.delete(element)
    element.pause()
    element.removeAttribute('src')
    element.load()
    element.remove()
    component.element.set(none)
    component.abortController.value.abort()
  },

  errors: ['MEDIA_ERROR', 'HLS_ERROR']
})

export const MediaComponent = defineComponent({
  name: 'XRE_media',

  onInit: (entity) => {
    return {
      controls: false,
      synchronize: true,
      autoplay: true,
      /**
       * TODO: refactor this into a ScheduleComponent for invoking callbacks at scheduled times
       * The auto start time for the playlist, in Unix/Epoch time (milliseconds).
       * If this value is negative, media playback must be explicitly started.
       * If this value is non-negative and in the past, playback as soon as possible.
       * If this value is in the future, begin playback at the appointed time.
       */
      // autoStartTime: -1,
      resources: [] as MediaResource[],
      playMode: PlayMode.loop as PlayMode,
      isMusic: false,
      volume: 1,
      // runtime props
      paused: true,
      playing: false,
      track: 0,
      trackDurations: [] as number[],
      helper: null as Mesh<PlaneGeometry, MeshBasicMaterial> | null
    }
  },

  onRemove: (entity, component) => {
    removeComponent(entity, MediaElementComponent)
  },

  toJSON: (entity, component) => {
    return {
      controls: component.controls.value,
      autoplay: component.autoplay.value,
      resources: component.resources.value,
      volume: component.volume.value,
      synchronize: component.synchronize.value,
      playMode: component.playMode.value,
      isMusic: component.isMusic.value
    }
  },

  onSet: (entity, component, json) => {
    console.log('Media component onset', entity, component, json)
    if (!json) return
    startTransition(() => {
      if (typeof json.paths === 'object') {
        // backwards-compat: update uvol paths to point to the video files
        const paths = json.paths.map((path) => path.replace('.drcs', '.mp4').replace('.uvol', '.mp4'))
        component.resources.set(
          paths.map((path) => {
            return {
              type: entity.type,
              path
            }
          })
        )
      }
      if (typeof json.resources === 'object') {
        component.resources.set(json.resources)
      }

      if (typeof json.controls === 'boolean' && json.controls !== component.controls.value)
        component.controls.set(json.controls)

      if (typeof json.autoplay === 'boolean' && json.autoplay !== component.autoplay.value)
        component.autoplay.set(json.autoplay)

      // backwars-compat: convert from number enums to strings
      if (
        (typeof json.playMode === 'number' || typeof json.playMode === 'string') &&
        json.playMode !== component.playMode.value
      ) {
        if (typeof json.playMode === 'number') {
          switch (json.playMode) {
            case 1:
              component.playMode.set(PlayMode.single)
              break
            case 2:
              component.playMode.set(PlayMode.random)
              break
            case 3:
              component.playMode.set(PlayMode.loop)
              break
            case 4:
              component.playMode.set(PlayMode.singleloop)
              break
          }
        } else {
          component.playMode.set(json.playMode)
        }
      }

      if (typeof json.isMusic === 'boolean' && component.isMusic.value !== json.isMusic)
        component.isMusic.set(json.isMusic)
    })

    return component
  },

  reactor: MediaReactor,

  errors: ['LOADING_ERROR', 'UNSUPPORTED_ASSET_CLASS']
})

export function MediaReactor({ root }: EntityReactorProps) {
  const entity = root.entity
  if (!hasComponent(entity, MediaComponent)) throw root.stop()

  const media = useComponent(entity, MediaComponent)
  const mediaElement = useOptionalComponent(entity, MediaElementComponent)
  const userHasInteracted = useHookstate(getState(EngineState).userHasInteracted)

  useEffect(
    function updatePlay() {
      if (!mediaElement) return
      if (media.paused.value) {
        mediaElement.element.value.pause()
      } else {
        mediaElement.element.value.play()
      }
    },
    [media.paused, mediaElement]
  )

  useEffect(
    function updateTrackMetadata() {
      clearErrors(entity, MediaComponent)

      const paths = media.resources.value.map((resource) => resource.mp3StaticResource.LOD0_url || resource.mp4StaticResourceLOD0_url)

      for (const path of paths) {
        const assetClass = AssetLoader.getAssetClass(path).toLowerCase()
        if (assetClass !== 'audio' && assetClass !== 'video') {
          return addError(entity, MediaComponent, 'UNSUPPORTED_ASSET_CLASS')
        }
      }

      const metadataListeners = [] as Array<{ tempElement: HTMLMediaElement; listener: () => void }>

      for (const [i, path] of paths.entries()) {
        const assetClass = AssetLoader.getAssetClass(path).toLowerCase()
        const tempElement = document.createElement(assetClass) as HTMLMediaElement
        const listener = () => media.trackDurations[i].set(tempElement.duration)
        metadataListeners.push({ tempElement, listener })
        tempElement.addEventListener('loadedmetadata', listener)
        tempElement.crossOrigin = 'anonymous'
        tempElement.preload = 'metadata'
        tempElement.src = path
      }

      // handle autoplay
      if (media.autoplay.value && userHasInteracted.value) media.paused.set(false)

      return () => {
        for (const { tempElement, listener } of metadataListeners) {
          tempElement.removeEventListener('loadedmetadata', listener)
          tempElement.src = ''
          tempElement.load()
        }
      }
    },
    [media.resources]
  )

  useEffect(
    function updatePausedUponInteract() {
      if (userHasInteracted.value && media.autoplay.value) media.paused.set(false)
    },
    [userHasInteracted]
  )

  useEffect(
    function updateMediaElement() {
      if (!isClient) return

      const track = media.track.value
      const path = media.resources[track].path.value
      if (!path) {
        if (hasComponent(entity, MediaElementComponent)) removeComponent(entity, MediaElementComponent)
        return
      }

      const mediaElement = getOptionalComponent(entity, MediaElementComponent)

      const assetClass = AssetLoader.getAssetClass(path).toLowerCase()

      if (assetClass !== 'audio' && assetClass !== 'video') {
        addError(entity, MediaComponent, 'UNSUPPORTED_ASSET_CLASS')
        return
      }

      if (!mediaElement || mediaElement.element.nodeName.toLowerCase() !== assetClass) {
        setComponent(entity, MediaElementComponent, {
          element: document.createElement(assetClass) as HTMLMediaElement
        })
        const mediaElementState = getComponentState(entity, MediaElementComponent)

        const element = mediaElementState.element.value

        element.crossOrigin = 'anonymous'
        element.preload = 'auto'
        element.muted = false
        element.setAttribute('playsinline', 'true')

        const signal = mediaElementState.abortController.signal.value

        element.addEventListener(
          'playing',
          () => {
            media.playing.set(true), clearErrors(entity, MediaElementComponent)
          },
          { signal }
        )
        element.addEventListener('waiting', () => media.playing.set(false), { signal })
        element.addEventListener(
          'error',
          (err) => {
            addError(entity, MediaElementComponent, 'MEDIA_ERROR', err.message)
            if (media.playing.value) media.track.set(getNextTrack(media.value))
          },
          { signal }
        )

        element.addEventListener(
          'ended',
          () => {
            if (media.playMode.value === PlayMode.single) return
            media.track.set(getNextTrack(media.value))
          },
          { signal }
        )

        const audioNodes = createAudioNodeGroup(
          element,
          Engine.instance.audioContext.createMediaElementSource(element),
          media.isMusic.value ? Engine.instance.gainNodeMixBuses.music : Engine.instance.gainNodeMixBuses.soundEffects
        )

        audioNodes.gain.gain.setTargetAtTime(media.volume.value, Engine.instance.audioContext.currentTime, 0.1)
      }

      setComponent(entity, MediaElementComponent)
      const mediaElementState = getComponentState(entity, MediaElementComponent)

      mediaElementState.hls.value?.destroy()
      mediaElementState.hls.set(undefined)

      if (isHLS(path)) {
        mediaElementState.hls.set(setupHLS(entity, path))
        mediaElementState.hls.value!.attachMedia(mediaElementState.element.value)
      } else {
        mediaElementState.element.src.set(path)
      }
    },
    [media.resources, media.track]
  )

  useEffect(
    function updateVolume() {
      const volume = media.volume.value
      const element = getOptionalComponent(entity, MediaElementComponent)?.element as HTMLMediaElement
      if (!element) return
      const audioNodes = AudioNodeGroups.get(element)
      if (audioNodes) {
        audioNodes.gain.gain.setTargetAtTime(volume, Engine.instance.audioContext.currentTime, 0.1)
      }
    },
    [media.volume]
  )

  useEffect(
    function updateMixbus() {
      if (!mediaElement?.value) return
      const element = mediaElement.element.get({ noproxy: true })
      const audioNodes = AudioNodeGroups.get(element)
      if (audioNodes) {
        audioNodes.gain.disconnect(audioNodes.mixbus)
        audioNodes.mixbus = media.isMusic.value
          ? Engine.instance.gainNodeMixBuses.music
          : Engine.instance.gainNodeMixBuses.soundEffects
        audioNodes.gain.connect(audioNodes.mixbus)
      }
    },
    [mediaElement, media.isMusic]
  )

  const debugEnabled = useHookstate(getState(EngineRendererState).nodeHelperVisibility)

  useEffect(() => {
    if (debugEnabled.value && !media.helper.value) {
      const helper = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ transparent: true, side: DoubleSide }))
      helper.name = `audio-helper-${root.entity}`
      AssetLoader.loadAsync(AUDIO_TEXTURE_PATH).then((AUDIO_HELPER_TEXTURE) => {
        helper.material.map = AUDIO_HELPER_TEXTURE
      })
      setObjectLayers(helper, ObjectLayers.NodeHelper)
      addObjectToGroup(root.entity, helper)
      media.helper.set(helper)
    }

    if (!debugEnabled.value && media.helper.value) {
      removeObjectFromGroup(root.entity, media.helper.value)
      media.helper.set(none)
    }
  }, [debugEnabled])

  return null
}

export const SCENE_COMPONENT_MEDIA = 'media'

export const setupHLS = (entity: Entity, url: string): Hls => {
  const hls = new Hls()
  hls.on(Hls.Events.ERROR, function (event, data) {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          // try to recover network error
          console.error('fatal network error encountered, try to recover', event, data)
          hls.startLoad()
          break
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.error('fatal media error encountered, try to recover', event, data)
          hls.recoverMediaError()
          break
        default:
          // cannot recover
          console.error('HLS fatal error encountered, destroying video...', event, data)
          hls.destroy()
          break
      }
      addError(entity, MediaElementComponent, 'HLS_ERROR')
    }
  })

  // hls.once(Hls.Events.LEVEL_LOADED, () => { resolve() })
  hls.on(Hls.Events.MEDIA_ATTACHED, () => {
    hls.loadSource(url)
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, _data) => {
      removeError(entity, MediaElementComponent, 'HLS_ERROR')
    })
  })

  return hls
}

export function getNextTrack(media: ComponentType<typeof MediaComponent>) {
  const currentTrack = media.track
  const numTracks = media.resources.length
  let nextTrack = 0

  if (media.playMode == PlayMode.random) {
    // todo: smart random, i.e., lower probability of recently played tracks
    nextTrack = Math.floor(Math.random() * numTracks)
  } else if (media.playMode == PlayMode.single) {
    nextTrack = (currentTrack + 1) % numTracks
  } else if (media.playMode == PlayMode.singleloop) {
    nextTrack = currentTrack
  } else {
    //PlayMode.Loop
    nextTrack = (currentTrack + 1) % numTracks
  }

  return nextTrack
}
