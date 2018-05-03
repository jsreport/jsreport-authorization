import React, { Component } from 'react'
import Studio from 'jsreport-studio'

const MultiSelect = Studio.MultiSelect

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

    const selectValues = (selectData) => {
      const { value: selectedValue, options } = selectData
      let res = []

      for (var i = 0; i < options.length; i++) {
        const optionIsSelected = selectedValue.indexOf(options[i].value) !== -1

        if (optionIsSelected) {
          res.push(options[i].value)
        }
      }

      return res
    }

    return (
      <div className='properties-section'>
        <div className='form-group'>
          <label>read permissions</label>
          <MultiSelect
            title='Use the checkboxes to select/deselect multiple options'
            size={7}
            value={entity.readPermissions || []}
            onChange={(selectData) => onChange({ _id: entity._id, readPermissions: selectValues(selectData) })}
            options={users.map(u => ({ key: u._id, name: u.username, value: u._id }))}
          />
        </div>
        <div className='form-group'>
          <label>edit permissions</label>
          <MultiSelect
            title='Use the checkboxes to select/deselect multiple options'
            size={7}
            value={entity.editPermissions || []}
            onChange={(selectData) => onChange({ _id: entity._id, editPermissions: selectValues(selectData) })}
            options={users.map(u => ({ key: u._id, name: u.username, value: u._id }))}
          />
        </div>
      </div>
    )
  }
}
