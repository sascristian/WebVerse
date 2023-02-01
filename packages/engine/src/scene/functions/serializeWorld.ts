import { MathUtils } from 'three'

import { EntityUUID } from '@xrengine/common/src/interfaces/EntityUUID'
import { ComponentJson, EntityJson, SceneJson } from '@xrengine/common/src/interfaces/SceneInterface'

import { Engine } from '../../ecs/classes/Engine'
import { Entity } from '../../ecs/classes/Entity'
import {
  getAllComponents,
  getComponent,
  getOptionalComponent,
  hasComponent,
  serializeComponent,
  useComponent
} from '../../ecs/functions/ComponentFunctions'
import { EntityTreeNode } from '../../ecs/functions/EntityTree'
import { iterateEntityNode } from '../../ecs/functions/EntityTree'
import { getSceneMetadataChanges } from '../../ecs/functions/getSceneMetadataChanges'
import { GLTFLoadedComponent } from '../components/GLTFLoadedComponent'
import { NameComponent } from '../components/NameComponent'
import { LoadState, PrefabComponent } from '../components/PrefabComponent'

export const serializeEntity = (entity: Entity, world = Engine.instance.currentWorld) => {
  const ignoreComponents = getOptionalComponent(entity, GLTFLoadedComponent)

  const jsonComponents = [] as ComponentJson[]
  const components = getAllComponents(entity)

  for (const component of components) {
    const sceneComponentID = world.sceneComponentRegistry.get(component.name)!
    if (
      sceneComponentID &&
      !ignoreComponents?.includes(component.name) &&
      world.sceneLoadingRegistry.has(sceneComponentID)
    ) {
      const serialize = world.sceneLoadingRegistry.get(sceneComponentID)?.serialize
      const data = serialize ? serialize(entity) : serializeComponent(entity, component)
      if (data) {
        jsonComponents.push({
          name: sceneComponentID,
          props: Object.assign({}, JSON.parse(JSON.stringify(data)))
        })
      }
    }
  }
  return jsonComponents
}

export const serializeWorld = (
  entityTreeNode?: EntityTreeNode,
  generateNewUUID = false,
  world = Engine.instance.currentWorld
) => {
  const entityUuid = {}
  const sceneJson = {
    version: 0,
    metadata: getSceneMetadataChanges(Engine.instance.currentWorld),
    entities: {},
    root: null! as EntityUUID
  }

  const traverseNode = entityTreeNode ?? world.entityTree.rootNode
  const loadedAssets = new Set<EntityTreeNode>()
  iterateEntityNode(
    traverseNode,
    (node, index) => {
      const ignoreComponents = getOptionalComponent(node.entity, GLTFLoadedComponent)

      if (ignoreComponents?.includes('entity')) return

      if (generateNewUUID) node.uuid = MathUtils.generateUUID() as EntityUUID
      const entityJson = (sceneJson.entities[node.uuid] = { components: [] as ComponentJson[] } as EntityJson)

      if (node.parentEntity) {
        entityJson.parent = node.parentEntity as any
        entityJson.index = index
      }

      if (node === entityTreeNode || !node.parentEntity) {
        sceneJson.root = node.uuid
      }

      entityUuid[node.entity] = node.uuid
      entityJson.name = getComponent(node.entity, NameComponent)

      entityJson.components = serializeEntity(node.entity, world)

      if (hasComponent(node.entity, PrefabComponent)) {
        const asset = getComponent(node.entity, PrefabComponent)
        if (asset.loaded === LoadState.LOADED) {
          asset.roots.map((root) => loadedAssets.add(root))
        }
      }
    },
    (node) => !loadedAssets.has(node),
    world.entityTree,
    true
  )

  Object.keys(sceneJson.entities).forEach((key) => {
    const entity = sceneJson.entities[key]
    if (entity.parent) entity.parent = entityUuid[entity.parent]
  })

  return sceneJson
}
