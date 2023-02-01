import { DataTypes, Model, Sequelize } from 'sequelize'

import { StaticResourceInterface } from '@xrengine/common/src/dbmodels/StaticResource'

import { Application } from '../../../declarations'
import generateShortId from '../../util/generate-short-id'

export default (app: Application) => {
  const sequelizeClient: Sequelize = app.get('sequelizeClient')
  const staticResource = sequelizeClient.define<Model<StaticResourceInterface>>(
    'static_resource',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        allowNull: false,
        primaryKey: true
      },
      sid: {
        type: DataTypes.STRING,
        defaultValue: (): string => generateShortId(8),
        allowNull: false
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true
      },
      key: DataTypes.STRING,
      mimeType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      project: {
        type: DataTypes.STRING,
        allowNull: true
      },
      driver: {
        type: DataTypes.STRING
      },
      fullQualityURL: {
        type: DataTypes.STRING
      },
      lowQualityURL: {
        type: DataTypes.STRING
      },
      mobileQualityURL: {
        type: DataTypes.STRING
      },
      fullQualitySize: {
        type: DataTypes.INTEGER
      },
      lowQualitySize: {
        type: DataTypes.INTEGER
      },
      mobileQualitySize: {
        type: DataTypes.INTEGER
      },
      licensing: {
        type: DataTypes.STRING
      },
      attribution: {
        type: DataTypes.STRING
      },
      tags: {
        type: DataTypes.JSON
      }
    },
    {
      hooks: {
        beforeCount(options: any): void {
          options.raw = true
        }
      }
    }
  )

  ;(staticResource as any).associate = (models: any): void => {
    ;(staticResource as any).belongsTo(models.static_resource_type, {
      foreignKey: 'staticResourceType',
      required: true
    })
    ;(staticResource as any).belongsTo(models.user)
    ;(staticResource as any).hasMany(models.static_resource, {
      as: 'parent',
      foreignKey: 'parentResourceId',
      allowNull: true
    })
  }

  return staticResource
}
