import { Vector3 } from 'three'

import { Engine } from '../../ecs/classes/Engine'
import { Entity } from '../../ecs/classes/Entity'
import { ComponentType, getComponent, hasComponent } from '../../ecs/functions/ComponentFunctions'
import { Physics } from '../../physics/classes/Physics'
import { AvatarComponent } from '../components/AvatarComponent'
import { AvatarControllerComponent } from '../components/AvatarControllerComponent'
import { createAvatarCollider } from './spawnAvatarReceptor'

export const resizeAvatar = (entity: Entity, height: number, center: Vector3) => {
  const avatar = getComponent(entity, AvatarComponent) as ComponentType<typeof AvatarComponent>

  avatar.avatarHeight = height
  avatar.avatarHalfHeight = avatar.avatarHeight / 2

  Physics.removeCollidersFromRigidBody(entity, Engine.instance.currentWorld.physicsWorld)

  const collider = createAvatarCollider(entity)

  if (hasComponent(entity, AvatarControllerComponent)) {
    ;(getComponent(entity, AvatarControllerComponent) as ComponentType<typeof AvatarControllerComponent>).bodyCollider =
      collider
  }
}
