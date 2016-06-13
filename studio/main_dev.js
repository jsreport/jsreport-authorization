import PermissionProperties from './PermissionProperties.js'
import Studio from 'jsreport-studio'

Studio.addPropertiesComponent('permissions', PermissionProperties, (entity) => entity.__entitySet !== 'users')
