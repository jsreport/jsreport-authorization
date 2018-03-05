import PermissionProperties from './PermissionProperties.js'
import Studio from 'jsreport-studio'

Studio.addPropertiesComponent('permissions', PermissionProperties, (entity) => entity.__entitySet !== 'users')

Studio.initializeListeners.push(async () => {
  if (!Studio.authentication) {
    return
  }

  Studio.authentication.useEditorComponents.push((user) => <div>
        Authorization
  </div>)
})
