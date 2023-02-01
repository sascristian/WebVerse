import React from 'react'
import { useTranslation } from 'react-i18next'

import { AssetLoader } from '@xrengine/engine/src/assets/classes/AssetLoader'
import { AllFileTypes } from '@xrengine/engine/src/assets/constants/fileTypes'
import { getComponent, useComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { getEntityErrors } from '@xrengine/engine/src/scene/components/ErrorComponent'
import { MediaComponent } from '@xrengine/engine/src/scene/components/MediaComponent'
import { TypeComponent } from '@xrengine/engine/src/scene/components/TypeComponent'
import { PlayMode } from '@xrengine/engine/src/scene/constants/PlayMode'

import { SupportedFileTypes } from '../../constants/AssetTypes'
import { PrefabFileType } from '../assets/FileBrowserContentPanel'
import ArrayInputGroup from '../inputs/ArrayInputGroup'
import BooleanInput from '../inputs/BooleanInput'
import { Button } from '../inputs/Button'
import CompoundNumericInput from '../inputs/CompoundNumericInput'
import InputGroup from '../inputs/InputGroup'
import SelectInput from '../inputs/SelectInput'
import NodeEditor from './NodeEditor'
import { EditorComponentType, updateProperty } from './Util'

const PlayModeOptions = [
  {
    label: 'Single',
    value: PlayMode.single
  },
  {
    label: 'Random',
    value: PlayMode.random
  },
  {
    label: 'Loop',
    value: PlayMode.loop
  },
  {
    label: 'SingleLoop',
    value: PlayMode.singleloop
  }
]

export const MediaNodeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()

  const media = useComponent(props.node.entity, MediaComponent)
  const errors = getEntityErrors(props.node.entity, MediaComponent)
  const type = useComponent(props.node.entity, TypeComponent)

  console.log('type pants', type, type.value)

  const toggle = () => {
    media.paused.set(!media.paused.value)
  }

  const updateResources = (e) => {
    console.log('props', props, props.node.entity.type)
    console.log('updateResources', e)
    const resources = e.map((path) => {
      console.log('path', path)
      const matchingCurrentMedia = media.resources.find(
        (resource) => resource.path === path && resource.type === type && resource.id != null
      )
      console.log('match current media', matchingCurrentMedia)
      const returned = {
        path,
        type: type.value
      }
      if (matchingCurrentMedia) returned.id = matchingCurrentMedia.id
      console.log('returned', returned)
      return returned
    })
    console.log('resources', resources)

    updateProperty(MediaComponent, 'resources')(resources)
  }

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.media.name')}
      description={t('editor:properties.media.description')}
    >
      {errors ? (
        Object.entries(errors).map(([err, message]) => {
          return <div style={{ marginTop: 2, color: '#FF8C00' }}>{'Error: ' + message}</div>
        })
      ) : (
        <></>
      )}
      <InputGroup name="Volume" label={t('editor:properties.media.lbl-volume')}>
        <CompoundNumericInput value={media.volume.value} onChange={updateProperty(MediaComponent, 'volume')} />
      </InputGroup>
      <InputGroup name="Is Music" label={t('editor:properties.media.lbl-isMusic')}>
        <BooleanInput value={media.isMusic.value} onChange={updateProperty(MediaComponent, 'isMusic')} />
      </InputGroup>
      <InputGroup
        name="Controls"
        label={t('editor:properties.media.lbl-controls')}
        info={t('editor:properties.media.info-controls')}
      >
        <BooleanInput value={media.controls.value} onChange={updateProperty(MediaComponent, 'controls')} />
      </InputGroup>
      <InputGroup
        name="Auto Play"
        label={t('editor:properties.media.lbl-autoplay')}
        info={t('editor:properties.media.info-autoplay')}
      >
        <BooleanInput value={media.autoplay.value} onChange={updateProperty(MediaComponent, 'autoplay')} />
      </InputGroup>
      <InputGroup
        name="Synchronize"
        label={t('editor:properties.media.lbl-synchronize')}
        info={t('editor:properties.media.info-synchronize')}
      >
        <BooleanInput value={media.synchronize.value} onChange={updateProperty(MediaComponent, 'synchronize')} />
      </InputGroup>
      <ArrayInputGroup
        name="Source Paths"
        prefix="Content"
        values={media.resources.value.map((resource) => resource.path)}
        onChange={updateResources}
        label={t('editor:properties.media.paths')}
        acceptFileTypes={AllFileTypes}
        itemType={SupportedFileTypes}
      ></ArrayInputGroup>
      <InputGroup name="Play Mode" label={t('editor:properties.media.playmode')}>
        <SelectInput
          key={props.node.entity}
          options={PlayModeOptions}
          value={media.playMode.value}
          onChange={updateProperty(MediaComponent, 'playMode')}
        />
        {media.resources && media.resources.length > 0 && media.resources[0] && (
          <Button style={{ marginLeft: '5px', width: '60px' }} type="submit" onClick={toggle}>
            {media.paused ? t('editor:properties.media.playtitle') : t('editor:properties.media.pausetitle')}
          </Button>
        )}
      </InputGroup>
    </NodeEditor>
  )
}

export default MediaNodeEditor
