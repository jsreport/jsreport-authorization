/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _PermissionProperties = __webpack_require__(1);
	
	var _PermissionProperties2 = _interopRequireDefault(_PermissionProperties);
	
	var _jsreportStudio = __webpack_require__(3);
	
	var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	_jsreportStudio2.default.addPropertiesComponent('permissions', _PermissionProperties2.default, function (entity) {
	  return entity.__entitySet !== 'users';
	});

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
	
	var _react = __webpack_require__(2);
	
	var _react2 = _interopRequireDefault(_react);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
	
	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }
	
	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }
	
	var PermissionProperties = function (_Component) {
	  _inherits(PermissionProperties, _Component);
	
	  function PermissionProperties() {
	    _classCallCheck(this, PermissionProperties);
	
	    return _possibleConstructorReturn(this, (PermissionProperties.__proto__ || Object.getPrototypeOf(PermissionProperties)).apply(this, arguments));
	  }
	
	  _createClass(PermissionProperties, [{
	    key: 'selectUsers',
	    value: function selectUsers(entities) {
	      return Object.keys(entities).filter(function (k) {
	        return entities[k].__entitySet === 'users' && !entities[k].__isNew;
	      }).map(function (k) {
	        return entities[k];
	      });
	    }
	  }, {
	    key: 'render',
	    value: function render() {
	      var _props = this.props,
	          entity = _props.entity,
	          entities = _props.entities,
	          _onChange = _props.onChange;
	
	      var users = this.selectUsers(entities);
	
	      if (entity.__entitySet === 'users') {
	        return _react2.default.createElement('div', null);
	      }
	
	      var selectValues = function selectValues(el) {
	        var res = [];
	        for (var i = 0; i < el.options.length; i++) {
	          if (el.options[i].selected) {
	            res.push(el.options[i].value);
	          }
	        }
	
	        return res;
	      };
	
	      return _react2.default.createElement(
	        'div',
	        { className: 'properties-section' },
	        _react2.default.createElement(
	          'div',
	          { className: 'form-group' },
	          _react2.default.createElement(
	            'label',
	            null,
	            'read permissions'
	          ),
	          _react2.default.createElement(
	            'select',
	            { title: 'Use CTRL to deselect item and also to select multiple options.',
	              multiple: true, value: entity.readPermissions || [],
	              onChange: function onChange(v) {
	                return _onChange({ _id: entity._id, readPermissions: selectValues(v.target) });
	              } },
	            users.map(function (e) {
	              return _react2.default.createElement(
	                'option',
	                { key: e._id, value: e._id },
	                e.username
	              );
	            })
	          )
	        ),
	        _react2.default.createElement(
	          'div',
	          { className: 'form-group' },
	          _react2.default.createElement(
	            'label',
	            null,
	            'edit permissions'
	          ),
	          _react2.default.createElement(
	            'select',
	            { title: 'Use CTRL to deselect item and also to select multiple options.',
	              multiple: true, value: entity.editPermissions || [],
	              onChange: function onChange(v) {
	                return _onChange({ _id: entity._id, editPermissions: selectValues(v.target) });
	              } },
	            users.map(function (e) {
	              return _react2.default.createElement(
	                'option',
	                { key: e._id, value: e._id },
	                e.username
	              );
	            })
	          )
	        )
	      );
	    }
	  }]);
	
	  return PermissionProperties;
	}(_react.Component);
	
	exports.default = PermissionProperties;

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = Studio.libraries['react'];

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = Studio;

/***/ }
/******/ ]);