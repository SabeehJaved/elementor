var ViewModule = require( 'elementor-utils/view-module' ),
	MentionView = require( 'elementor-micro-elements/mention-view' );

module.exports = ViewModule.extend( {
	$element: null,

	lastCaretPosition: null,

	mentionsInstance: null,

	mentions: [],

	__construct: function( settings ) {
		this.$element = settings.$element;
	},

	getDefaultElements: function() {
		var elements = {},
			$addButton = this.getSettings( '$addButton' );

		if ( $addButton ) {
			elements.$addButton = $addButton;
		}

		return elements;
	},

	getDefaultSettings: function() {
		return {
			$element: null,
			$addButton: null,
			$iframe: null,
			value: null,
			groups: [],
			freeText: true,
			mixedContent: true,
			multiple: true
		};
	},

	bindEvents: function() {
		this.$element
			.on( 'blur', this.onElementBlur.bind( this ) )
			.on( 'keydown', this.onElementKeyDown.bind( this ) );

		if ( this.elements.$addButton ) {
			this.elements.$addButton.on( 'click', this.onAddMentionClick.bind( this ) );
		}
	},

	setValue: function( value ) {
		var self = this;

		self.destroyMentions();

		var parsedValue = elementor.microElements.parseTagsText( value, this.getSettings(), function( tagID, tagName, tagSettings ) {
			tagSettings = tagSettings ? _.escape( JSON.stringify( tagSettings ) ) : '';

			return '<span class="atwho-inserted" contenteditable="false" data-tag-id="' + tagID + '" data-tag-name="' + tagName + '" data-elementor-settings="' + tagSettings + '"></span>';
		} );

		self.$element.html( parsedValue );

		self.$element.find( '.atwho-inserted' ).each( function() {
			var mentionData = jQuery( this ).data();

			self.createMentionView( {
				element: this,
				id: mentionData.tagId,
				name: mentionData.tagName,
				settings: mentionData.elementorSettings,
				silent: true
			} );
		} );
	},

	initMentions: function() {
		var tags = elementor.microElements.getConfig( 'tags' ),
			groups = this.getSettings( 'groups' );

		tags = _.filter( tags, function( tag ) {
			return _.intersection( tag.groups, groups ).length;
		} );

		this.$element.atwho( {
			at: '@',
			data: tags,
			displayTpl: function( item ) {
				return '<li>' + item.title + '</li>';
			},
			lookUpOnClick: false
		} );

		this.mentionsInstance = this.$element.data( 'atwho' );

		this.mentionsController = this.mentionsInstance.controllers['@'];

		this.handleMentionInsert();
	},

	createMentionView: function( options ) {
		var self = this;

		var mentionView = new MentionView( {
			el: options.element,
			name: options.name,
			id: options.id || elementor.helpers.getUniqueID(),
			settings: options.settings || {},
			$iframe: this.getSettings( '$iframe' )
		} );

		mentionView.render();

		if ( ! options.silent ) {
			self.trigger( 'mention:create', mentionView );
		}

		mentionView.on( 'remove', function() {
			self.trigger( 'mention:remove', mentionView );
		} );

		mentionView.model.on( 'change', function() {
			self.trigger( 'mention:change', mentionView );
		} );

		mentionView.getMentionsPopup().on( {
			show: function() {
				self.trigger( 'mention:popup:show', mentionView );
			},
			hide: function() {
				self.trigger( 'mention:popup:hide', mentionView );
			}
		} );

		this.mentions.push( mentionView );
	},

	handleMentionInsert: function() {
		var self = this,
			insert = this.mentionsController.insert;

		this.mentionsController.insert = function( content, $li ) {
			insert.apply( this, arguments );

			self.createMentionView( {
				element: this.query.el[0],
				name: $li.data( 'item-data' ).name
			} );
		};
	},

	getValue: function() {
		var $clonedElement = this.$element.clone(),
			$tags = $clonedElement.find( '.atwho-inserted' );

		$tags.each( function() {
			var $tag = jQuery( this ),
				tagData = $tag.data();

			$tag.replaceWith( elementor.microElements.tagDataToTagText( tagData.tagId, tagData.tagName, tagData.elementorSettings ) );
		} );

		return $clonedElement.html().replace( '&nbsp;', ' ' ).trim();
	},

	getMentionsCount: function() {
		return this.$element.find( '.atwho-inserted' ).length;
	},

	isAtKey: function( event ) {
		return 50 === event.which && event.shiftKey;
	},

	isFreeTextKey: function( event ) {
		if ( this.isAtKey( event ) ) {
			return false;
		}

		var allowedKeys = [
			8, // Backspace
			46 // Delete
		];

		return -1 === allowedKeys.indexOf( event.which );
	},

	freeTextAllowed: function() {
		if ( ! this.getSettings( 'freeText' ) ) {
			return false;
		}

		return ! ( ! this.getSettings( 'mixedContent' ) && this.getMentionsCount() );
	},

	mentionAllowed: function() {
		if ( ! this.getSettings( 'multiple' ) && this.getMentionsCount() ) {
			return false;
		}

		return ! ( ! this.getSettings( 'mixedContent' ) && this.getValue() );
	},

	destroyMentions: function() {
		this.mentions.forEach( function( mention ) {
			mention.destroy();
		} );

		this.mentions = [];
	},

	destroy: function() {
		this.destroyMentions();

		this.$element.atwho( 'destroy' );
	},

	onInit: function() {
		ViewModule.prototype.onInit.apply( this, arguments );

		this.setValue( this.getSettings( 'value' ) );

		this.initMentions();
	},

	onElementBlur: function() {
		this.lastCaretPosition = this.$element.caret( 'pos' );
	},

	onElementKeyDown: function( event ) {
		if (
			this.isAtKey( event ) && ! this.mentionAllowed() ||
			this.isFreeTextKey( event ) && ! this.freeTextAllowed()
		) {
			event.preventDefault();
		}
	},

	onAddMentionClick: function() {
		if ( ! this.mentionAllowed() ) {
			if ( ! this.getSettings( 'mixedContent' ) && this.getValue() && ! this.getMentionsCount() ) {
				this.$element.empty();
			} else {
				return;
			}
		}

		var lastCaretPosition = this.lastCaretPosition,
			textLength = this.$element.text().length;

		if ( ! lastCaretPosition || ! textLength ) {
			lastCaretPosition = textLength;
		}

		this.$element
			.focus()
			.caret( 'pos', lastCaretPosition );

		var selection = getSelection(),
			range = selection.getRangeAt( 0 ),
			endContainerData = range.endContainer.data,
			addAt = '@';

		if ( endContainerData ) {
			if ( endContainerData.match( '@$' ) ) { // Content ends with a @.
				addAt = '';
			} else if ( ! endContainerData.match( ' $' ) ) { // Content ends with a text.
				addAt = ' @';
			}
		}

		range.deleteContents();

		range.insertNode( document.createTextNode( addAt ) );

		if ( addAt ) {
			this.$element.caret( 'pos', lastCaretPosition + addAt.length );
		}

		this.mentionsController.lookUp( { which: '' } );
	}
} );