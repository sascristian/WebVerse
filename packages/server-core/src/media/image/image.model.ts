import { DataTypes, Model, Sequelize } from 'sequelize'

import { ImageInterface } from '@xrengine/common/src/dbmodels/Image'

import { Application } from '../../../declarations'

export default (app: Application) => {
  const sequelizeClient: Sequelize = app.get('sequelizeClient')
  const image = sequelizeClient.define<Model<ImageInterface>>(
    'image',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING
      },
      tags: {
        type: DataTypes.JSON
      },
      height: {
        type: DataTypes.INTEGER
      },
      width: {
        type: DataTypes.INTEGER
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

  ;(image as any).associate = (models: any): void => {
    ;(image as any).belongsTo(models.static_resource, {
      foreignKey: 'pngStaticResourceId',
      required: false
    })
    ;(image as any).belongsTo(models.static_resource, {
        foreignKey: 'jpegStaticResourceId',
        required: false
    })
    ;(image as any).belongsTo(models.static_resource, {
        foreignKey: 'gifStaticResourceId',
        required: false
    })
    ;(image as any).belongsTo(models.static_resource, {
        foreignKey: 'ktx2StaticResourceId',
        required: false
    })
    ;(image as any).belongsTo(models.image, {
      foreignKey: 'thumbnailId',
      required: false
    })
  }

  return image
}
