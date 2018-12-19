import React, { Component } from 'react'
import Studio from 'jsreport-studio'

const EntityRefSelect = Studio.EntityRefSelect

const selectValues = (selected) => {
  return selected.map((e) => e._id)
}

export default class PermissionProperties extends Component {
  render () {
    const { entity, onChange } = this.props

    if (entity.__entitySet === 'users') {
      return <div />
    }

    return (
      <div className='properties-section'>
        <div className='form-group'>
          <label>read permissions</label>
          <EntityRefSelect
            headingLabel='Select user (read permissions)'
            filter={(references) => {
              const users = references.users.filter((e) => !e.__isNew)
              return { users: users }
            }}
            value={entity.readPermissions ? entity.readPermissions.map((_id) => Studio.getEntityById(_id, false).shortid) : []}
            onChange={(selected) => onChange({ _id: entity._id, readPermissions: selectValues(selected) })}
            multiple
          />
        </div>
        <div className='form-group'>
          <label>edit permissions</label>
          <EntityRefSelect
            headingLabel='Select user (edit permissions)'
            filter={(references) => {
              const users = references.users.filter((e) => !e.__isNew)
              return { users: users }
            }}
            value={entity.editPermissions ? entity.editPermissions.map((_id) => Studio.getEntityById(_id, false).shortid) : []}
            onChange={(selected) => onChange({ _id: entity._id, editPermissions: selectValues(selected) })}
            multiple
          />
        </div>
      </div>
    )
  }
}
