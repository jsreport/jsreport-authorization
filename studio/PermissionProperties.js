import React, { Component } from 'react'

export default class PermissionProperties extends Component {
  selectUsers (entities) {
    return Object.keys(entities).filter((k) => entities[k].__entitySet === 'users' && !entities[k].__isNew).map((k) => entities[k])
  }

  render () {
    const { entity, entities, onChange } = this.props
    const users = this.selectUsers(entities)

    if (entity.__entitySet === 'users') {
      return <div />
    }

    const selectValues = (el) => {
      let res = []
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].selected) {
          res.push(el.options[i].value)
        }
      }

      return res
    }

    return (
      <div className='properties-section'>
        <div className='form-group'>
          <label>read permissions</label>
          <select title='Use CTRL to deselect item and also to select multiple options.'
            multiple value={entity.readPermissions || []}
            onChange={(v) => onChange({_id: entity._id, readPermissions: selectValues(v.target)})}>
            {users.map((e) => <option key={e._id} value={e._id}>{e.username}</option>)}
          </select>
        </div>
        <div className='form-group'>
          <label>edit permissions</label>
          <select title='Use CTRL to deselect item and also to select multiple options.'
            multiple value={entity.editPermissions || []}
            onChange={(v) => onChange({_id: entity._id, editPermissions: selectValues(v.target)})}>
            {users.map((e) => <option key={e._id} value={e._id}>{e.username}</option>)}
          </select>
        </div>
      </div>
    )
  }
}

