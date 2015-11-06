define('permissions.dialog',["app", "underscore", "core/view.base"],
    function (app, _, ViewBase) {

        return ViewBase.extend({
            template: "template-permissions-dialog",

            initialize: function () {
                _.bindAll(this, "save", "getUsers");
            },

            events: {
                "click #okCommand": "save"
            },

            save: function () {
                this.model.save({
                    success: function () {
                        app.layout.dialog.hide();
                    }
                });
            },

            getUsers: function () {
                return this.model.users;
            },

            onDomRefresh: function () {
                this.$el.find('#readPermissions').multiselect();
                this.$el.find('#editPermissions').multiselect();
            }
        });
    });
define('permissions.model',["app", "underscore", "core/basicModel"],
    function (app, _, ModelBase) {

        return ModelBase.extend({
            initialize: function() {
                this.usersModel = new app.authentication.UsersListModel();
            },

            fetch: function(options) {
                var self = this;

                if (!self.entityModel.get("readPermissions"))
                    self.entityModel.set("readPermissions", []);
                if (!self.entityModel.get("editPermissions"))
                    self.entityModel.set("editPermissions", []);

                self.set("readPermissions", self.entityModel.get("readPermissions"));
                self.set("editPermissions", self.entityModel.get("editPermissions"));

                this.usersModel.fetch({
                    success: function() {
                        self.users = self.usersModel.toJSON();
                        options.success();
                    }
                });
            },

            save: function(options) {
                this.entityModel.set("editPermissions", this.get("editPermissions"));
                this.entityModel.set("readPermissions", this.get("readPermissions"));
                var self = this;

                this.entityModel.save({}, {
                    success: function() {
                        self.entityModel.fetch(options);
                    }
                });
            }
        });
    });
define('permissions.toolbar.view',["app", "underscore", "core/view.base", "permissions.dialog", "permissions.model"],
    function (app, _, ViewBase, PermissionsDialog, PermissionsModel) {

       return ViewBase.extend({
            tagName: "li",
            template: "template-permissions",

            initialize: function () {
                _.bindAll(this, "permissions");
            },

            events: {
                "click #permissionsCommand": "permissions"
            },

            permissions: function () {
                var model = new PermissionsModel();

                model.entityModel = this.model;
                var dialog = new PermissionsDialog({model: model});

                model.fetch({
                    success: function () {
                        app.layout.dialog.show(dialog);
                    }
                });
            }
        });
    });

define(["app", "underscore", "marionette", "backbone", "permissions.toolbar.view"],
    function (app, _,  Marionette, Backbone, PermissionsToolbarView) {

        if (!app.authentication)
            return;

        app.module("authorization", function (module) {
            app.on("toolbar-render", function (context) {
                var view = new PermissionsToolbarView({ model: context.model });
                context.region.show(view, "permissions");
            });
        });
    });
