var fs = require('fs');
const { remote, BrowserWindow } = require('electron');
const { clear } = require('console');
const { Menu, MenuItem, dialog } = remote;
const NewBrowserWindow = remote.BrowserWindow;

// Constants

//TODO: Tags Permanent.

var typeColor = {
	"Text" : "#668440",
	"Choice" : "rgb(179, 166, 69)",
	"Node" : "#ddd",
	"Set" : "rgb(27, 63, 117)",
	"Branch" : "rgb(173, 123, 72)",
	"Note" : "rgb(247, 237, 165)"
}

var con =
{
	allowable_connections:
	[
		['dialogue.Text', 'dialogue.Text'],
		['dialogue.Text', 'dialogue.Node'],
		['dialogue.Text', 'dialogue.Choice'],
		['dialogue.Text', 'dialogue.Set'],
		['dialogue.Text', 'dialogue.Branch'],
		['dialogue.Node', 'dialogue.Text'],
		['dialogue.Node', 'dialogue.Node'],
		['dialogue.Node', 'dialogue.Choice'],
		['dialogue.Node', 'dialogue.Set'],
		['dialogue.Node', 'dialogue.Branch'],
		['dialogue.Choice', 'dialogue.Text'],
		['dialogue.Choice', 'dialogue.Node'],
		['dialogue.Choice', 'dialogue.Set'],
		['dialogue.Choice', 'dialogue.Branch'],
		['dialogue.Set', 'dialogue.Text'],
		['dialogue.Set', 'dialogue.Node'],
		['dialogue.Set', 'dialogue.Set'],
		['dialogue.Set', 'dialogue.Branch'],
		['dialogue.Branch', 'dialogue.Text'],
		['dialogue.Branch', 'dialogue.Node'],
		['dialogue.Branch', 'dialogue.Set'],
		['dialogue.Branch', 'dialogue.Branch'],
	],

	default_link: new joint.dia.Link(
	{
		attrs:
		{
			'.marker-target': { d: 'M 10 0 L 0 5 L 10 10 z', },
			'.link-tools .tool-remove circle, .marker-vertex': { r: 8 },
		},
	}),
};
con.default_link.set('smooth', true);

// State

var state =
{
	graph: new joint.dia.Graph(),
	paper: null,
	filepath: null,
	panning: false,
	mouse_position: { x: 0, y: 0 },
	context_position: { x: 0, y: 0 },
	menu: null,
	globalVariables: [],
	actors: [],
};

//var globalVariables = [];
// Models

joint.shapes.dialogue = {};
joint.shapes.dialogue.Base = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Base',
			size: { width: 210, height: 50 },
			name: '',
			attrs:
			{
				rect: { stroke: 'none', 'fill-opacity': 0 },
				text: { display: 'none' },
			}
		},
		joint.shapes.devs.Model.prototype.defaults
	),
});

joint.shapes.dialogue.BaseView = joint.shapes.devs.ModelView.extend(
{
	template:
	[
		'<div id="" class="node">',
		'<div class="title">',
		'<span class="header-img">',
		'<img src="g/directions.png"></img>',
		'</span>',
		'<button class="delete">x</button>',
		'</div>',
		'<textarea class="name" rows="2" cols="27" placeholder="Speech"></textarea>',
		'</div>',
	].join(''),

	initialize: function()
	{
		_.bindAll(this, 'updateBox');
		joint.shapes.devs.ModelView.prototype.initialize.apply(this, arguments);

		this.$box = $(_.template(this.template)());
		// Prevent paper from handling pointerdown.
		this.$box.find('input').on('mousedown click', function(evt) { evt.stopPropagation(); });

		this.$box.find('textarea').on('mousedown click', function(evt) { evt.stopPropagation(); });

		// This is an example of reacting on the input change and storing the input data in the cell model.
		this.$box.find('input.name').on('change', _.bind(function(evt)
		{
			this.model.set('name', $(evt.target).val());
		}, this));

		autosize(this.$box.find('textarea.name'));

		this.$box.find('textarea.name').on('change', _.bind(function(evt)
		{;
			this.model.set('name', $(evt.target).val());
		}, this));

		this.$box.find('input.actor').on('change', _.bind(function(evt)
		{
			this.model.set('actor', $(evt.target).val());
		}, this));

		this.$box.find('.delete').on('click', _.bind(this.model.remove, this.model));
		// Update the box position whenever the underlying model changes.
		this.model.on('change', this.updateBox, this);
		// Remove the box when the model gets removed from the graph.
		this.model.on('remove', this.removeBox, this);

		UpdateNodeList();

		this.$box.find('textarea.name').on('keydown', _.bind(function(evt)
		{
			setTimeout(_.bind(function(evt, model) {
				model.set('name', $(evt.target).val());
				UpdateNodeList();
			}), 100, evt, this.model);
		}, this));

		this.updateBox();
	},

	render: function()
	{
		joint.shapes.devs.ModelView.prototype.render.apply(this, arguments);
		this.paper.$el.prepend(this.$box);
		this.updateBox();
		return this;
	},

	updateBox: function()
	{
		// Set the position and dimension of the box so that it covers the JointJS element.
		var bbox = this.model.getBBox();
		// Example of updating the HTML with a data stored in the cell model.
		var nameField = this.$box.find('input.name');
		if (!nameField.is(':focus'))
			nameField.val(this.model.get('name'));

		var textAreaField = this.$box.find('textarea.name');
		if (!textAreaField.is(':focus')) {
			textAreaField.val(this.model.get('name'))
		}

		var actorField = this.$box.find('input.name');
		if (!actorField.is(':focus'))
			actorField.val(this.model.get('actor'));

		var label = this.$box.find('.label');
		var title = this.$box.find('.title');
		var type = this.model.get('type').slice('dialogue.'.length);
		label.text(type);
		label.attr('class', 'label ' + type);
		title.attr('class', 'title ' + type);
		this.$box.attr('id', this.model.id);
		this.$box.css({ width: bbox.width, height: bbox.height, left: bbox.x, top: bbox.y, transform: 'rotate(' + (this.model.get('angle') || 0) + 'deg)' });
	},

	removeBox: function(evt)
	{
		this.$box.remove();
	},
});

joint.shapes.dialogue.Node = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Node',
			inPorts: ['input'],
			outPorts: ['output'],
			attrs:
			{
				rotatable: { stroke: 'none' },
				rect: { stroke: 'none' },
				'.outPorts circle': { unlimitedConnections: ['dialogue.Choice'] },
			},
		},
		joint.shapes.dialogue.Base.prototype.defaults
	),
});
joint.shapes.dialogue.NodeView = joint.shapes.dialogue.BaseView;

joint.shapes.dialogue.Text = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Text',
			inPorts: ['input'],
			outPorts: ['output'],
			actor: '',
			tags: [],
			attrs:
			{
				'.outPorts circle': { unlimitedConnections: ['dialogue.Choice'], }
			},
		},
		joint.shapes.dialogue.Base.prototype.defaults
	),
});
//joint.shapes.dialogue.TextView = joint.shapes.dialogue.BaseView;
joint.shapes.dialogue.TextView = joint.shapes.dialogue.BaseView.extend(
	{
		template:
		[
			'<div class="node">',
			//'<div class="title">',
			'<div class="title">',
			'<span class="header-img">',
			'<img src="g/article.png"></img>',
			'</span>',
			'<button class="delete">x</button>',
			'<select type="actor" class="actors" placeholder="Actor"></select>',
			'<button class="add">+</button>',
			'<button class="remove">-</button>',
			'<button class="show">&middot;</button>',
			'</div>',
			'<textarea class="name" rows="2" cols="27" placeholder="Speech"></textarea>',
			'</div>',
		].join(''),

		initialize: function() {
			joint.shapes.dialogue.BaseView.prototype.initialize.apply(this, arguments);
			this.$box.find('.add').on('click', _.bind(this.addTag, this));
			this.$box.find('.remove').on('click', _.bind(this.removeTag, this));
			this.$box.find('.show').on('click', _.bind(this.toggleTagsDisplay, this));

			this.$box.find('select.actors').on('change', _.bind(function(evt)
			{
				this.model.set('actor', $(evt.target).val());
				$(evt.target).val(this.model.get('actor'));
			}, this));
		},

		addTag: function() {
			if (this.model.get('tags').length != 0 && this.$box.find('input.tag')[0].style.display == "none")
				return;

			var tags = this.model.get('tags').slice(0);
			tags.push(null);
			this.model.set('tags', tags);
			this.updateSize();
		},

		removeTag: function() {
			if (this.model.get('tags').length != 0 && this.$box.find('input.tag')[0].style.display == "none")
				return;

			var tags = this.model.get('tags').slice(0);
			tags.pop();
			this.model.set('tags', tags);
			this.updateSize();
		},

		toggleTagsDisplay: function() {
			var fields = this.$box.find('input.tag');

			if (fields.length == 0)
				return;

			var t = "";

			if (fields[0].style.display == "none") {
				t = "grid";
			}
			else if (fields[0].style.display == "grid") {
				t = "none";
			}
			else {
				t = "none";
			}

			for (var i = 0; i < fields.length; i++) {
				fields[i].style.display = t;
			}

			if (t == "none") {
				this.$box.find('button.show').text(fields.length);
			}
			else {
				this.$box.find('button.show').text('');
			}

			this.updateSize();
		},

		updateBox: function() {
			joint.shapes.dialogue.BaseView.prototype.updateBox.apply(this, arguments);
			var tags = this.model.get('tags');
			var tagFields = this.$box.find('input.tag');
			
			var selectFields = this.$box.find('select.actors').find('option.actor');
			for (var i = 0; i < selectFields.length; i++) {
				$(selectFields[i]).remove();
			}

			for (var i = 0; i < state.actors.length; i++) {
				var actor = state.actors[i].name;
				var $el = $('<option class="actor">' + actor+ '</option>');
				$el.val(actor);

				if (actor == null)
					continue;

				this.$box.find('select.actors').append($el);
			}

			var field = this.$box.find('select.actors');
			if (!field.is(':focus'))
				field.val(this.model.get('actor'));

			for (var i = tagFields.length; i < tags.length; i++) {
				var $field = $('<input type="text" class="tag"/>');
				$field.attr('placeholder', '#tag');
				this.$box.append($field);
				$field.on('mousedown click', function(evt) { evt.stopPropagation(); });

				$field.on('change', _.bind(function(evt)
				{
					var tags = this.model.get('tags').slice(0);
					tags[i - 1] = $(evt.target).val();
					this.model.set('tags', tags);
				}, this));
			}

			for (var i = tags.length; i < tagFields.length; i++)
				$(tagFields[i]).remove();

			tagFields = this.$box.find('input.tag');
			for (var i = 0; i < tagFields.length; i++)
			{
				var field = $(tagFields[i]);
				if (!field.is(':focus'))
					field.val(tags[i]);
			}
		},

		updateSize: function()
		{
			var fields = this.model.get('tags');
			var tagField = this.$box.find('input.tag');

			var n = 0;

			for (var i = 0; i < tagField.length; i++) {
				if (tagField[i].style.display != "none") {
					n++;
				}
			}

			var height = tagField.outerHeight(true);
			this.model.set('size', { width: this.model.get('size').width, height: 50 + Math.max(0, (n) * height) });
		},
	});

joint.shapes.dialogue.Choice = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Choice',
			size: { width: 200, height: 60, },
			inPorts: ['input'],
			outPorts: [],
			choices: [],
		},
		joint.shapes.dialogue.Base.prototype.defaults
	),
});
joint.shapes.dialogue.ChoiceView = joint.shapes.dialogue.BaseView.extend(
{
	template:
	[
		'<div class="node">',
		'<div class="title">',
		'<span class="header-img">',
		'<img src="g/alt_route.png"></img>',
		'</span>',
		'<button class="delete">x</button>',
		'<button class="add">+</button>',
		'<button class="remove">-</button>',
		'</div>',
		'</div>',
	].join(''),

	initialize: function()
	{
		joint.shapes.dialogue.BaseView.prototype.initialize.apply(this, arguments);
		this.$box.find('.add').on('click', _.bind(this.addPort, this));
		this.$box.find('.remove').on('click', _.bind(this.removePort, this));

		// Create some choices, have to do this manually.
		if (this.model.get('outPorts').length == 0) {
			this.addPort();
			this.addPort();
			this.model.set('size', { width: 200, height: 96 });
		}
	},

	removePort: function()
	{
		if (this.model.get('outPorts').length > 1)
		{
			var outPorts = this.model.get('outPorts').slice(0);
			outPorts.pop();
			this.model.set('outPorts', outPorts);
			var choices = this.model.get('choices').slice(0);
			choices.pop();
			this.model.set('choices', choices);
			this.updateSize();
		}
		else if (this.model.get('outPorts').length == 1){
			this.model.remove();
		}
	},

	addPort: function()
	{
		var outPorts = this.model.get('outPorts').slice(0);
		outPorts.push('output' + outPorts.length.toString());
		this.model.set('outPorts', outPorts);
		var choices = this.model.get('choices').slice(0);
		choices.push(null);
		this.model.set('choices', choices);
		this.updateSize();
	},

	updateBox: function()
	{
		joint.shapes.dialogue.BaseView.prototype.updateBox.apply(this, arguments);

		var choices = this.model.get('choices');
		var valueFields = this.$box.find('textarea.choice');

		for (var i = valueFields.length; i < choices.length; i++)
		{
			// Prevent paper from handling pointerdown.
			var $field = $('<textarea class="choice" type="text" />');
			$field.attr('placeholder', 'Value ' + (i + 1).toString());
			$field.attr('index', i);
			this.$box.append($field);
			$field.on('mousedown click', function(evt) { evt.stopPropagation(); });
			
			// This is an example of reacting on the input change and storing the input data in the cell model.
			$field.on('change', _.bind(function(evt)
			{
				var choices = this.model.get('choices').slice(0);
				choices[$(evt.target).attr('index')] = $(evt.target).val();
				this.model.set('choices', choices);
			}, this));
		}

		for (var i = choices.length; i < valueFields.length; i++)
		{
			$(valueFields[i]).remove();
		}

		// Update value fields
		valueFields = this.$box.find('textarea.choice');
		for (var i = 0; i < valueFields.length; i++)
		{
			var field = $(valueFields[i]);
			if (!field.is(':focus'))
				field.val(choices[i]);
		}
	},

	updateSize: function()
	{
		//if (this.model.get('outPorts').length == 1)
		//	return;

		var textField = this.$box.find('textarea.choice');
		var height = textField.outerHeight(true);
		this.model.set('size', { width: 200, height: 60 + Math.max(0, (this.model.get('outPorts').length - 1) * height) });
	},
});

joint.shapes.dialogue.Branch = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Branch',
			size: { width: 200, height: 60, },
			inPorts: ['input'],
			outPorts: ['output0'],
			values: [],
		},
		joint.shapes.dialogue.Base.prototype.defaults
	),
});
joint.shapes.dialogue.BranchView = joint.shapes.dialogue.BaseView.extend(
{
	template:
	[
		'<div class="node">',
		//'<div class="title">',
		'<div class="title">',
		'<span class="header-img">',
		'<img src="g/alt_route.png"></img>',
		'</span>',
		'<button class="delete">x</button>',
		'<button class="add">+</button>',
		'<button class="remove">-</button>',
		'</div>',
		//'<input type="text" class="name" placeholder="Variable" />',
		'<select class="variableSelect" placeholder="Variable Name"></select>',
		'<input type="text" value="Default" readonly/>',
		'</div>',
	].join(''),

	initialize: function()
	{
		joint.shapes.dialogue.BaseView.prototype.initialize.apply(this, arguments);
		this.$box.find('.add').on('click', _.bind(this.addPort, this));
		this.$box.find('.remove').on('click', _.bind(this.removePort, this));

		this.$box.find('select.variableSelect').on('change', _.bind(function(evt)
		{
			this.model.set('name', $(evt.target).val());
			$(evt.target).val(this.model.get('name'));
		}, this));

		this.updateBox();
	},

	removePort: function()
	{
		if (this.model.get('outPorts').length > 1)
		{
			var outPorts = this.model.get('outPorts').slice(0);
			outPorts.pop();
			this.model.set('outPorts', outPorts);
			var values = this.model.get('values').slice(0);
			values.pop();
			this.model.set('values', values);
			this.updateSize();
		}
	},

	addPort: function()
	{
		var outPorts = this.model.get('outPorts').slice(0);
		outPorts.push('output' + outPorts.length.toString());
		this.model.set('outPorts', outPorts);
		var values = this.model.get('values').slice(0);
		values.push(null);
		this.model.set('values', values);
		this.updateSize();
	},

	updateBox: function()
	{
		joint.shapes.dialogue.BaseView.prototype.updateBox.apply(this, arguments);
		var values = this.model.get('values');
		var valueFields = this.$box.find('input.branchOption');

		var selectFields = this.$box.find('select.variableSelect').find('option.variable');
		for (var i = 0; i < selectFields.length; i++) {
			$(selectFields[i]).remove();
		}

		for (var i = 0; i < state.globalVariables.length; i++) {
			var global = state.globalVariables[i];
			var $el = $('<option class="variable">' + global + '</option>');
			$el.val(global);

			if (global == null)
				continue;

			this.$box.find('select.variableSelect').append($el);
		}

		var field = this.$box.find('select.variableSelect');
		if (!field.is(':focus'))
			field.val(this.model.get('name'));

		// Add value fields if necessary
		for (var i = valueFields.length; i < values.length; i++)
		{
			// Prevent paper from handling pointerdown.
			var $field = $('<input class="branchOption" type="text" class="value" />');
			$field.attr('placeholder', 'Value ' + (i + 1).toString());
			$field.attr('index', i);
			 this.$box.append($field);
			//$('<div></div>')
			$field.on('mousedown click', function(evt) { evt.stopPropagation(); });

			// This is an example of reacting on the input change and storing the input data in the cell model.
			$field.on('change', _.bind(function(evt)
			{
				var values = this.model.get('values').slice(0);
				values[$(evt.target).attr('index')] = $(evt.target).val();
				this.model.set('values', values);
			}, this));
		}

		// Remove value fields if necessary, except for default field.
		for (var i = values.length; i < valueFields.length; i++)
		{
			$(valueFields[i]).remove();
		}	

		// Update value fields
		valueFields = this.$box.find('input.branchOption');
		for (var i = 0; i < valueFields.length; i++)
		{
			var field = $(valueFields[i]);
			if (!field.is(':focus'))
				field.val(values[i]);
		}
	},

	updateSize: function()
	{
		var textField = this.$box.find('input.branchOption');
		var height = textField.outerHeight(true);
		this.model.set('size', { width: 200, height: 60 + Math.max(0, (this.model.get('outPorts').length - 1) * height) });
	},
});

joint.shapes.dialogue.Set = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Set',
			inPorts: ['input'],
			outPorts: ['output'],
			size: { width: 200, height: 60, },
			value: '',
		},
		joint.shapes.dialogue.Base.prototype.defaults
	),
});

joint.shapes.dialogue.SetView = joint.shapes.dialogue.BaseView.extend(
{
	template:
	[
		'<div class="node">',
		'<div class="title">',
		'<div class="title">',
		'<span class="header-img">',
		'<img src="g/login.png"></img>',
		'</span>',
		'<button class="delete">x</button>',
		'</div>',
		//'<input type="text" class="name" placeholder="Variable" />',
		'<select class="variableSelect" placeholder="Variable Name"></select>',
		'<input type="text" class="value" placeholder="Value" />',
		'</div>',
	].join(''),

	initialize: function()
	{
		joint.shapes.dialogue.BaseView.prototype.initialize.apply(this, arguments);

		this.$box.find('input.value').on('change', _.bind(function(evt)
		{
			this.model.set('value', $(evt.target).val());
		}, this));

		this.$box.find('select.variableSelect').on('change', _.bind(function(evt)
		{
			this.model.set('name', $(evt.target).val());
			$(evt.target).val(this.model.get('name'));
		}, this));
	},

	updateBox: function()
	{
		joint.shapes.dialogue.BaseView.prototype.updateBox.apply(this, arguments);

		var selectFields = this.$box.find('select.variableSelect').find('option.variable');
		for (var i = 0; i < selectFields.length; i++) {
			$(selectFields[i]).remove();
		}

		for (var i = 0; i < state.globalVariables.length; i++) {
			var global = state.globalVariables[i];

			if (global == null)
				continue;

			var $el = $('<option class="variable">' + global + '</option>');
			$el.val(global);

			this.$box.find('select.variableSelect').append($el);
		}

		var field = this.$box.find('select.variableSelect');
		if (!field.is(':focus'))
			field.val(this.model.get('name'));

		field = this.$box.find('input.value');
		if (!field.is(':focus'))
			field.val(this.model.get('value'));
	},
});

joint.shapes.dialogue.Note = joint.shapes.devs.Model.extend(
{
	defaults: joint.util.deepSupplement
	(
		{
			type: 'dialogue.Note',
		},
		joint.shapes.dialogue.Base.prototype.defaults
	),
});
joint.shapes.dialogue.NoteView = joint.shapes.dialogue.BaseView.extend(
{
	template:
	[
		'<div class="node note">',
		'<div class="title">',
		'<span class="header-img">',
		'<img src="g/attach_file.png"></img>',
		'</span>',
		'<button class="delete">x</button>',
		'</div>',
		'<textarea class="name" rows="6" cols="27" placeholder="Speech"></textarea>',
		'</div>',
	].join(''),
});

// Functions

var func = {};

func.validate_connection = function(cellViewS, magnetS, cellViewT, magnetT, end, linkView)
{
	// Prevent loop linking
	if (magnetS === magnetT)
		return false;

	if (cellViewS === cellViewT)
		return false;

	if ($(magnetT).parents('.outPorts').length > 0) // Can't connect to an output port
		return false;

	var sourceType = cellViewS.model.attributes.type;
	var targetType = cellViewT.model.attributes.type;
	var valid = false;
	for (var i = 0; i < con.allowable_connections.length; i++)
	{
		var rule = con.allowable_connections[i];
		if (sourceType === rule[0] && targetType === rule[1])
		{
			valid = true;
			break;
		}
	}
	if (!valid)
		return false;

	var links = state.graph.getConnectedLinks(cellViewS.model);
	for (var i = 0; i < links.length; i++)
	{
		var link = links[i];
		if (link.attributes.source.id === cellViewS.model.id && link.attributes.source.port === magnetS.attributes.port.nodeValue && link.attributes.target.id)
		{
			var targetCell = state.graph.getCell(link.attributes.target.id);
			if (targetCell.attributes.type !== targetType)
				return false; // We can only connect to multiple targets of the same type
			if (targetCell === cellViewT.model)
				return false; // Already connected
		} 
	}

	return true;
};

func.validate_magnet = function(cellView, magnet)
{
	if ($(magnet).parents('.outPorts').length === 0)
		return false; // we only want output ports

	// If unlimited connections attribute is null, we can only ever connect to one object
	// If it is not null, it is an array of type strings which are allowed to have unlimited connections
	var unlimitedConnections = magnet.getAttribute('unlimitedConnections');
	var links = state.graph.getConnectedLinks(cellView.model);
	for (var i = 0; i < links.length; i++)
	{
		var link = links[i];
		if (link.attributes.source.id === cellView.model.id && link.attributes.source.port === magnet.attributes.port.nodeValue)
		{
			// This port already has a connection
			if (unlimitedConnections && link.attributes.target.id)
			{
				var targetCell = state.graph.getCell(link.attributes.target.id);
				if (unlimitedConnections.indexOf(targetCell.attributes.type) !== -1)
					return true; // It's okay because this target type has unlimited connections
			} 
			return false;
		}
	}

	return true;
};

func.optimized_data = function()
{
	var data = {};
	data.globals = state.globalVariables;
	data.actors = state.actors;

	var cells = state.graph.toJSON().cells;
	var nodesByID = {};
	var cellsByID = {};
	var nodes = [];
	for (var i = 0; i < cells.length; i++)
	{
		var cell = cells[i];

		if (cell.type == 'dialogue.Note') {
			continue;
		}

		if (cell.type != 'link')
		{
			var node =
			{
				type: cell.type.slice('dialogue.'.length),
				id: cell.id,
				actor: cell.actor
			};
			if (node.type === 'Branch')
			{
				node.variable = cell.name;
				node.branches = {};
				for (var j = 0; j < cell.values.length; j++)
				{
					var branch = cell.values[j];
					node.branches[branch] = null;
				}
			}
			else if (node.type === 'Set')
			{
				node.variable = cell.name;
				node.value = cell.value;
				node.next = null;
			}
			else if (node.type === 'Text') {
				node.name = cell.name;
				node.next = null;
				node.actor = cell.actor;
				node.tags = [];
				for (var j = 0; j < cell.tags.length; j++) {
					var s = cell.tags[j];

					if (s[0] != '#') {
						var s = '#' + s;
					}

					node.tags[j] = s;
				}
			}
			else if (node.type === 'Choice') {
				node.choices = {};
				for (var j = 0; j < cell.choices.length; j++) {
					var choice = cell.choices[j];
					node.choices[choice] = null;
				}
			}
			else
			{
				node.name = cell.name;
				node.next = null;
				node.actor = cell.actor;
			}
			nodes.push(node);
			nodesByID[cell.id] = node;
			cellsByID[cell.id] = cell;
		}
	}
	for (var i = 0; i < cells.length; i++)
	{
		var cell = cells[i];
		if (cell.type === 'link')
		{
			var source = nodesByID[cell.source.id];
			var target = cell.target ? nodesByID[cell.target.id] : null;
			if (source)
			{
				if (source.type === 'Branch')
				{
					var portNumber = parseInt(cell.source.port.slice('output'.length));
					var value;
					if (portNumber === 0)
						value = '_default';
					else
					{
						var sourceCell = cellsByID[source.id];
						value = sourceCell.values[portNumber - 1];
					}
					source.branches[value] = target ? target.id : null;
				}
				else if (source.type === 'Choice') {
					var portNumber = parseInt(cell.source.port.slice('output'.length));
					var sourceCell = cellsByID[source.id];
					var value = sourceCell.choices[portNumber];
					source.choices[value] = target ? target.id : null;
				}
				else
					source.next = target ? target.id : null;
			}
		}
	}

	data.nodes = nodes;
	return data;
};

// Menu actions

func.flash = function(text)
{
	var $flash = $('#flash');
	$flash.text(text);
	$flash.stop(true, true);
	$flash.show();
	$flash.css('opacity', 1.0);
	$flash.fadeOut({ duration: 1500 });
};

func.apply_fields = function()
{
	$('input[type=text], select').blur();
};

func.save = function()
{
	func.apply_fields()

	if (!state.filepath) {
		var filePath = dialog.showSaveDialog({title: "Save conversation", defaultPath: "dialogue.dl"
			, filters: [{name: 'Dialogue File', extensions: ['dl']}]}
				).then(result => {
				state.filepath = result.filePath
				func.do_save();
			})
	} else {
		func.do_save()
	}
};

func.optimized_filename = function(f)
{
	return f.substring(0, f.length - 2) + 'json';
};

func.do_save = function()
{
	if (state.filepath)
	{
		// Probably a better way of doing this, especially when adding actors and other stuff.
		var dl_data = JSON.stringify(state.graph);
		dl_data = JSON.parse(dl_data);
		dl_data.globals = state.globalVariables;
		dl_data.actors = state.actors;
		fs.writeFileSync(state.filepath, JSON.stringify(dl_data), 'utf8');
		fs.writeFileSync(func.optimized_filename(state.filepath), JSON.stringify(func.optimized_data(), null, "\t"), 'utf8');
		func.flash('Saved ' + state.filepath);
	}
};

func.filename_from_filepath = function(f)
{
	return f.replace(/^.*[\\\/]/, '');
};

func.show_open_dialog = function()
{
	$('#file_open').click();
};

func.show_save_dialog = function()
{
	$('#file_save').click();
};

func.add_node = function(constructor)
{
	return function()
	{
		var container = $('#container')[0];
		var element = new constructor(
		{
			position: { x: state.context_position.x + container.scrollLeft, y: state.context_position.y + container.scrollTop },
		});
		state.graph.addCells([element]);
		UpdateNodeList();
	};
};

func.clear = function()
{
	state.graph.clear();
	state.filepath = null;
	document.title = 'Conversation Consternation';
};

func.handle_open_files = function(files)
{
	state.filepath = files[0].path;
	var data = fs.readFileSync(state.filepath);
	document.title = func.filename_from_filepath(state.filepath);
	state.graph.clear();
	var data = JSON.parse(data);

	state.globalVariables = data.globals;
	UpdateGlobalVariables();

	state.actors = data.actors;
	UpdateActorsMenu();

	state.graph.fromJSON({ "cells" : data.cells });
};

func.handle_save_files = function(files)
{
	state.filepath = files[0].path;
	func.do_save();
};

func.exit = function()
{
	func.apply_fields();

	if (!state.filepath) {
		if (confirm("You're about to exit without saving your file! Do you want to save?")) {
			func.save();
		} else {
			window.close();
			previewWindow.close();
		}
	} else {
		window.close();
		previewWindow.close();
	}
};

// New Stuff, to be sorted later

// Probably a faster algorithm out there.

function queryNodes() {
	var $searchbar = $("#search-bar");

	var searchTerms = $searchbar.val();
	var cells = state.graph.toJSON().cells

	searchTerms = searchTerms.split(" ");

	if (cells.length === 0)
		return;

	if (searchTerms === null || searchTerms == "")
		return;

	clearQuery(false);

	for (var i = 0; i < cells.length; i++) {
		var cell = cells[i];

		var type = cell.type.slice('dialogue.'.length);
		for (var j = 0; j < searchTerms.length; j++) {
			var term = searchTerms[j];

			if (term[0] === '#') {
				if (cell.tags != null && cell.tags != []) {
					for (var k = 0; k < cell.tags.length; k++) {
						if (cell.tags[k] === term)
							GetNodeById(cell.id).attr('class', 'node highlight');
					}
				}
			}
			else if (term[0] === '$') {
				if (cell.actor != null && cell.actor != "") {
					if (cell.actor === term.substring(1))
							GetNodeById(cell.id).attr('class', 'node highlight');
				}
			}
			else if (term[0] === '@') {
				if (type === 'Branch' || type === 'Set') {
					if (cell.name === term.substring(1))
						GetNodeById(cell.id).attr('class', 'node highlight');
				}
			}
			else {
				if (type === 'Text') {
					var speech = cell.name.split(" ");

					if (speech != null && speech != "") {
						for (var k = 0; k < speech.length; k++) {
							if (speech[k] == term)
								GetNodeById(cell.id).attr('class', 'node highlight');
						}
					}
				}
				else if (type === 'Choice') {
					for (var k = 0; k < cell.choices.length; k++) {
						var speech = cell.choices[k].split(" ");

						for (var l = 0; l < speech.length; l++) {
							if (speech[l] == term)
							GetNodeById(cell.id).attr('class', 'node highlight');
						}
					}
				}
			}
		}
	}
}

function clearQuery(clearSearchText = true) {
	if (clearSearchText) {
		var $searchbar = $("#search-bar");
		$searchbar.val("");
	}

	var cells = state.graph.toJSON().cells

	for (var i = 0; i < cells.length; i++) {
		var cell = cells[i];

		GetNodeById(cell.id).attr('class', 'node');
	}
}

function GetNodeById(ID) {
	return $("div#" + ID + ".node");
}

function AddGlobalVar() {
	state.globalVariables.push(null);
	UpdateGlobalVariables();
}

function RemoveGlobalVar(index) {
	state.globalVariables.splice(index, 1);
	UpdateGlobalVariables();
}

function UpdateGlobalVariables() {
	var $box = $('#globals-box');

	var globals = state.globalVariables;
	var globalFields = $box.find('div.varBox');

	for (var i = globalFields.length; i < globals.length; i++) {
		var $variableField = $('<input type="text" class="variable"/>');
		$variableField.attr('placeholder', 'Variable Name');
		$variableField.on('mousedown click', function(evt) { evt.stopPropagation(); });
		
		var $destroyButton = $('<button class="hot-menu-button" type="button" onClick="RemoveGlobalVar(' + i.toString() + ')">-</button>');

		$varBox = $('<div class="varBox"></div>');
		$varBox.append($variableField);
		$varBox.append($destroyButton);

		$box.append($varBox);
		$variableField.on('change', _.bind(function(evt)
		{
			var globals = state.globalVariables;
			if (!globals.includes($(evt.target).val())) {
				globals[i - 1] = $(evt.target).val();
				state.globalVariables = globals;
				UpdateChoiceDropdowns();
			}
			else {
				$(evt.target).val("");
			}
		}, this));
	}

	for (var i = state.globalVariables.length; i < globalFields.length; i++) {
		$(globalFields[i]).remove();
	}	

	globalFields = $box.find('div.varBox');
	for (var i = 0; i < globalFields.length; i++) {
		var field = $(globalFields[i]).find('input.variable');

		if (!field.is(':focus'))
			field.val(state.globalVariables[i]);
	}
}

function UpdateChoiceDropdowns() {
	var cells = state.graph.toJSON().cells

	if (cells.length == 0)
		return;

	for (var i = 0; i < cells.length; i++) {
		var cell = cells[i];
		var type = cell.type.slice('dialogue.'.length);

		if (type === 'Branch' || type === 'Set') {
			state.graph.getCell(cell.id)._events.change[0].context.updateBox();
		}
	}
}

function AddActor() {
	state.actors.push({"name": null, "portraitfile" : null, "tags": [], "color" : "", "isPlayer" : false});
	UpdateActorsMenu();
}

function RemoveActor(index) {
	state.actors.splice(index, 1);
	UpdateActorsMenu();
}

function PortraitFile(index) {
	let options = {
		title: "Select Image File",
		filters: [
			{name: 'Images', extensions: ['jpg', 'png', 'tga']}
		],
		properties: ['openFile']
	};

	var actor = state.actors[index];

	dialog.showOpenDialog(BrowserWindow, options).then(result => { 
		
		if (actor) 
			actor.portraitfile = result.filePaths[0];
		
		$('#portrait-filename' + index.toString()).text(result.filePaths[0].replace(/^.*[\\\/]/, '')); 
	
	}).catch(err => { console.log(err) });
}

function UpdateActorsMenu() {
	var $box = $('#actors-box');

	var actors = state.actors;
	var actorFields = $box.find('div.actorBox');

	for (var i = actorFields.length; i < actors.length; i++) {
		var $actorBox = $('<div class="actorBox"><button type="button" class="collapsible">Actor</button><div class="actor-content"></div></div>');

		var $actorNameField = $('<input type="text" class="value" />');
		$actorNameField.attr('placeholder', 'Name');

		var $actorColorField = $('<input class="color" type="color" onchange="clickColor(0, -1, -1, 5) value=#ff0000"/>');
		var $actorIsPlayerField = $('<input class="isPlayer" name="isPlayer" type="radio">Player</actor>');

		var $actorPortraitFileNameField = $('<button id="portrait-file-select" onclick="PortraitFile(' + i + ')">Portrait</button>');
		$actorPortraitFileNameField.attr('placeholder', 'Portrait');

		var $potraitFileNameTitle = $('<span class="portrait-filename-preview" id="portrait-filename' + i.toString() + '" />');

		var $actorDeleteButton = $('<button type="button" class="actor-delete" onclick="RemoveActor(' + i.toString() + ')">Delete Actor</button>')

		$actorBox.find('div.actor-content').append($actorNameField);
		$actorBox.find('div.actor-content').append($('<br>'));
		$actorBox.find('div.actor-content').append($actorPortraitFileNameField);
		$actorBox.find('div.actor-content').append($potraitFileNameTitle);
		$actorBox.find('div.actor-content').append($actorColorField);
		$actorBox.find('div.actor-content').append($actorIsPlayerField);
		$actorBox.find('div.actor-content').append($actorDeleteButton);

		$box.append($actorBox);

		var coll = $actorBox.find('button.collapsible');

		coll.on("click", function() {
			this.classList.toggle("active");
			var content = this.nextElementSibling;
			if (content.style.display === "block") {
				content.style.display = "none";
			} else {
				content.style.display = "block";
			}
		});

		$actorNameField.on('change', _.bind(function(evt)
		{
			var actors = state.actors;
			actors[i - 1].name = $(evt.target).val();
			$actorBox.find('button.collapsible').text($(evt.target).val());
			state.actors = actors;
		}, this));

		$actorColorField.on('change', _.bind(function(evt)
		{
			var actors = state.actors;
			actors[i - 1].color = $(evt.target).val();
			state.actors = actors;
			console.log(state.actors);
		}, this));

		$actorIsPlayerField.on('click', _.bind(function(evt)
		{
			var actors = state.actors;
			actors[i - 1].isPlayer = $(evt.target).is(":checked");
			state.actors = actors;
			UpdateActorsIsPlayerFields();
		}, this));
	}

	for (var i = state.actors.length; i < actorFields.length; i++) {
		$(actorFields[i]).remove();
	}

	actorFields = $box.find('div.actorBox');
	for (var i = 0; i < actorFields.length; i++) {
		var field = $(actorFields[i]).find('input.value');

		if (!field.is(':focus')) {
			field.val(state.actors[i].name);
			$(actorFields[i]).find('input.color').val(state.actors[i].color);
			$(actorFields[i]).find('input.isPlayer').prop("checked", state.actors[i].isPlayer);
		}

		if (state.actors[i].name != null)
			field = $(actorFields[i]).find('button.collapsible').text(state.actors[i].name);

		if (state.actors[i].portraitfile != null) {
			field = $('#portrait-filename' + i.toString());
			field.text(state.actors[i].portraitfile.replace(/^.*[\\\/]/, ''));
		}
	}
}

function UpdateActorsIsPlayerFields() {
	var $box = $('#actors-box');

	var actorFields = $box.find('div.actorBox');
	for (var i = 0; i < actorFields.length; i++) {
		var field = $(actorFields[i]).find('input.isPlayer');

		state.actors[i].isPlayer = field.is(":checked");
	}
}

//TODO: Add scroll to area.

var globalListActivated = true;

function ToggleGlobalNodeList() {
	globalListActivated = !globalListActivated;

	$('div.nodelist-box').children("div.cellBox").toggle();
}

function UpdateNodeList() {
	var $box = $('div.nodelist-box');

	var all_cells = state.graph.toJSON().cells
	var cells = [];
	var cellFields = $box.find('div.cellBox');

	for (var i = 0; i < all_cells.length; i++) {
		if (all_cells[i].type != 'link') {
			cells.push(all_cells[i]);
		}
	}

	for (var i = cellFields.length; i < cells.length; i++) {
		var $cellBox = $('<div class=cellBox></div>');

		var type = cells[i].type.slice('dialogue.'.length)

		$cellBox.attr("id", cells[i].id);

		$cellBox.css("border-color", typeColor[type]);
		$cellBox.css("background-color", typeColor[type]);

		$cellBox.append('<span class="text"></span>');
		$cellBox.append('<button class="delete">x</button>');

		$cellBox.children().css("display", "inline-block");

		$cellBox.find('span.text').text(cells[i].id);

		$box.append($cellBox);

		if (!globalListActivated)
			$box.children().last().toggle();
	}

	for (var i = cells.length; i < cellFields.length; i++) {
		$(cellFields[i]).remove();
	}

	cellFields = $box.find('div.cellBox');
	for (var i = 0; i < cellFields.length; i++) {
		var field = $(cellFields[i]);
		var cell = cells[i];
		var type = cell.type.slice('dialogue.'.length);
		field.css("border-color", typeColor[type]);
		field.css("background-color", typeColor[type]);
		field.attr("id", cell.id);
		
		field.find('span.text').text(cell.id);

		// Look out, this has caused problems, may still not work.
		field.find('.delete').off().on('click', { id: cell.id }, function(evt) {
			state.graph.getCell(evt.data.id).remove();
		});

		if (cell.type.slice('dialogue.'.length) == "Note") {
			field.css("color", "black");
		}
		else {
			field.css("color", "white");
		}

		if (cell.name == "" && cell.actor == "") {
			field.find('span.text').text(cell.id);
		}
		else {
			if (cell.name == "") {
				field.find('span.text').text(cell.actor);
			}
			else {
				field.find('span.text').text(cell.name);
			}
		}
	}
}

let previewWindow;

function InitPreviewWindow() {
	remote.getGlobal('current_dialogue').data = func.optimized_data();
	remote.getCurrentWindow().setSize(600, 800, true);
	remote.getCurrentWindow().center();
	remote.getCurrentWindow().loadFile("indexPreview.html");
}

// Initialize

(function()
{
	state.paper = new joint.dia.Paper(
	{
		el: $('#paper'),
		width: 16000,
		height: 8000,
		model: state.graph,
		gridSize: 1,
		defaultLink: con.default_link,
		validateConnection: func.validate_connection,
		validateMagnet: func.validate_magnet,
		snapLinks: { radius: 75 }, // enable link snapping within 75px lookup radius
		markAvailable: true,
	});

	state.paper.on('blank:pointerdown', function(e, x, y)
	{
		if (e.button === 0 || e.button === 1)
		{
			state.panning = true;
			state.mouse_position.x = e.pageX;
			state.mouse_position.y = e.pageY;
			$('body').css('cursor', 'move');
			func.apply_fields();
		}
	});
	state.paper.on('cell:pointerdown', function(e, x, y)
	{
		func.apply_fields();
	});

	$('#container').mousemove(function(e)
	{
		if (state.panning)
		{
			var $this = $(this);
			$this.scrollLeft($this.scrollLeft() + state.mouse_position.x - e.pageX);
			$this.scrollTop($this.scrollTop() + state.mouse_position.y - e.pageY);
			state.mouse_position.x = e.pageX;
			state.mouse_position.y = e.pageY;
		}
	});

	$('#container').mouseup(function(e)
	{
		state.panning = false;
		$('body').css('cursor', 'default');
	});

	$('#file_open').on('change', function()
	{
		if (this.files)
			func.handle_open_files(this.files);
		// clear files from this input
		var $this = $(this);
		$this.wrap('<form>').parent('form').trigger('reset');
		$this.unwrap();
	});

	$('#search-bar').on('keydown', function() { setTimeout(queryNodes, 100) });

	$('#file_save').on('change', function()
	{
		func.handle_save_files(this.files);
	});

	$('body').on('dragenter', function(e)
	{
		e.stopPropagation();
		e.preventDefault();
	});

	$('body').on('dragexit', function(e)
	{
		e.stopPropagation();
		e.preventDefault();
	});

	$('body').on('dragover', function(e)
	{
		e.stopPropagation();
		e.preventDefault();
	});

	$('body').on('drop', function(e)
	{
		e.stopPropagation();
		e.preventDefault();
		func.handle_open_files(e.originalEvent.dataTransfer.files);
	});

	$(window).on('keydown', function(event)
	{
		// Catch Ctrl-S or key code 19 on Mac (Cmd-S)
		if (((event.ctrlKey || event.metaKey) && String.fromCharCode(event.which).toLowerCase() === 's') || event.which === 19)
		{
			event.stopPropagation();
			event.preventDefault();
			func.save();
			return false;
		}
		else if ((event.ctrlKey || event.metaKey) && String.fromCharCode(event.which).toLowerCase() === 'o')
		{
			event.stopPropagation();
			event.preventDefault();
			func.show_open_dialog();
			return false;
		}
		else if (String.fromCharCode(event.which).toLowerCase() === 'f12' || event.which === 123) {
			remote.getCurrentWindow().webContents.openDevTools();
			return false;
		}
		else if (String.fromCharCode(event.which).toLowerCase() === 'f5' || event.which === 116) {
			remote.getCurrentWindow().reload()
			return false;
		}
		else if (String.fromCharCode(event.which).toLowerCase() === 'f1' || event.which === 112
				|| String.fromCharCode(event.which).toLowerCase() == 'escape' || event.which === 27) {
			func.exit();
			return false;
		}
		return true;
	});

	$(window).resize(function()
	{
		func.apply_fields();
		var $window = $(window);
		var $container = $('#container');
		$container.height($window.innerHeight());
		$container.width($window.innerWidth());
		return this;
	});

	$(window).trigger('resize');

	//TODO: Could just run whenever the user changes something.
	setInterval(UpdateNodeList, 100);

	// Context menu

	state.menu = new Menu();
	state.menu.append(new MenuItem({ label: 'Text', click: func.add_node(joint.shapes.dialogue.Text) }));
	state.menu.append(new MenuItem({ label: 'Choice', click: func.add_node(joint.shapes.dialogue.Choice) }));
	state.menu.append(new MenuItem({ label: 'Branch', click: func.add_node(joint.shapes.dialogue.Branch) }));
	state.menu.append(new MenuItem({ label: 'Set', click: func.add_node(joint.shapes.dialogue.Set) }));
	state.menu.append(new MenuItem({ label: 'Note', click: func.add_node(joint.shapes.dialogue.Note) }));
	state.menu.append(new MenuItem({ type: 'separator' }));
	state.menu.append(new MenuItem({ label: 'Play', click: InitPreviewWindow}));
	state.menu.append(new MenuItem({ label: 'Save', click: func.save }));
	state.menu.append(new MenuItem({ label: 'Open', click: func.show_open_dialog }));
	state.menu.append(new MenuItem({ label: 'New', click: func.clear }));
	state.menu.append(new MenuItem({ label: 'Exit', click: func.exit }));

	document.body.addEventListener('contextmenu', function(e)
	{
		e.preventDefault();
		state.context_position.x = e.x;
		state.context_position.y = e.y;
		state.menu.popup();
		return false;
	}, false);
})();