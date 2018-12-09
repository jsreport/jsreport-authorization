/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Extension for authorizing requests and data access. It is dependent on Authentication extension.
 *
 * Adds property readPermissions and editPermissions to every object as array od user ids identifying which
 * user can work on which object.
 */
const modificationListeners = require('./modificationListeners')
const foldersMigration = require('./foldersMigration')

module.exports = function (reporter, definition) {
  if (!reporter.authentication) {
    definition.options.enabled = false
    return
  }

  reporter.documentStore.model.entityTypes['UserType'].editAllPermissions = { type: 'Edm.Boolean' }
  reporter.documentStore.model.entityTypes['UserType'].readAllPermissions = { type: 'Edm.Boolean' }
  reporter.documentStore.model.entityTypes['FolderType'].visibilityPermissions = { type: 'Collection(Edm.String)' }

  reporter.addRequestContextMetaConfig('skipAuthorization', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('skipAuthorizationForUpdate', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('skipAuthorizationForInsert', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('skipAuthorizationForQuery', { sandboxHidden: true })

  reporter.documentStore.on('before-init', (documentStore) => {
    for (const key in documentStore.model.entitySets) {
      const entitySet = documentStore.model.entitySets[key]
      if (entitySet.shared) {
        continue
      }

      const entityType = documentStore.model.entityTypes[entitySet.entityType.replace(documentStore.model.namespace + '.', '')]

      entityType.readPermissions = { type: 'Collection(Edm.String)' }
      entityType.editPermissions = { type: 'Collection(Edm.String)' }
      entityType.inheritedReadPermissions = { type: 'Collection(Edm.String)' }
      entityType.inheritedEditPermissions = { type: 'Collection(Edm.String)' }
    }
  })

  reporter.authorization = {
    findPermissionFilteringListeners: reporter.createListenerCollection(),
    requestAuthorizationListeners: reporter.createListenerCollection(),
    operationAuthorizationListeners: reporter.createListenerCollection(),
    authorizeRequest: async function (req, res) {
      const authRes = await this.requestAuthorizationListeners.fireAndJoinResults(req, res)
      if (authRes === null) {
        return req.context.user !== null && req.context.user !== undefined
      }

      return authRes
    }
  }

  reporter.authorization.findPermissionFilteringListeners.add(definition.name, (collection, query, req) => {
    const filter = [
      { readPermissions: req.context.user._id.toString() },
      { editPermissions: req.context.user._id.toString() },
      { inheritedReadPermissions: req.context.user._id.toString() },
      { inheritedEditPermissions: req.context.user._id.toString() }
    ]

    if (collection.name === 'folders') {
      filter.push({ visibilityPermissions: req.context.user._id.toString() })
    }

    if (query.$or) {
      query.$and = [...query.$and || [], { $or: filter }, { $or: query.$or }]
      delete query.$or
    } else {
      query.$or = filter
    }
  })

  modificationListeners(reporter)

  reporter.initializeListeners.add('authorization', async () => {
    if (definition.options.foldersMigrationEnabled !== false) {
      await foldersMigration(reporter)
    }

    for (const key in reporter.documentStore.collections) {
      const col = reporter.documentStore.collections[key]

      if (reporter.documentStore.model.entitySets[col.entitySet].shared) {
        continue
      }

      col.beforeFindListeners.add('authorize', (q, p, req) => {
        if (col.entitySet.shared) {
          return
        }

        if (req && req.context && req.context.user && req.context.user._id && !req.context.user.isAdmin && !req.context.user.readAllPermissions &&
              req.context.skipAuthorization !== true && req.context.skipAuthorizationForQuery !== q) {
          return reporter.authorization.findPermissionFilteringListeners.fire(col, q, req)
        }
      })
    }
  })
}
