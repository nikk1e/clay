/*

INVARIANTS

* Must have newline and cell separator characters as
  you can place a cursor either side of them.

  -- separators (they are not part of either the cell or the paragraph)

* Don\'t have to split on newline characters. Can put attributes into the document
  to say what they are.

*/

var UNDEFINED;

//Treat elements as immutable so all methods can be memoized
function Element(klass, options) {
	options = options || {};
	this.type = options.type || 'element';
	this._attribute = options.attribute || this.type;
	//this.children = []; //MUST BE IN SUBCLASS

	Element._constructors = Element._constructors || {}
	Element._constructors[this.type] = klass;

	this.klass = klass;
}
Element.prototype.init = function() {
	this.calculateLength();
};
Element.prototype.calculateLength = function() {
	var acc = 0;
	for (var i = this.children.length - 1; i >= 0; i--) {
		acc += this.children[i].length;
	};
	this.length = acc;
	return this.length;
};
Element.prototype.textContent = function() {
	if (this._textContent === UNDEFINED) {
		this._textContent = this.children.map(function(c) {
			return (typeof c === 'string'? c : c.textContent());
		}).join('');
	}
	return this._textContent;
}
Element.prototype.toJSON = function() {
	var ret = {};
	ret.type = this.type;
	for(var k in this) {
		if (this.hasOwnProperty(k) && !(/^_/.test(k)) && k !== 'length')
			ret[k] = this[k];
	}
	return ret;
};
Element.prototype.operationsForRange = function(start, end, ops) {
	ops = ops || [];
	if (start < 0) {
		if (end > this.length) {
			ops.push(this); 
			return ops; //range covers whole element
		} else {
			//push down
			ops.push(new Mark(this._attribute, this.options, this.type))
		}
	}
	var cursor = 0;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		var len = end - cursor;
		if (len < 0) break;
		//skip elements before start
		if (cursor + child.length >= start) {
			if (cursor > start && child.length < len) {
				ops.push(child);
			} else if (typeof child === 'string') {
				if (end > cursor) {
					var offset = start > cursor ? start - cursor : 0;
					if (offset < child.length) ops.push(child.slice(offset,len));
				}
			} else {
				child.operationsForRange(start - cursor, len, ops);
			}
		}
		cursor += child.length;
	};
	if (end > this.length) {
		//pop up
		ops.push(new EndMark(this._attribute));
	}
	return ops;
};


//first fragment in a document is main content.
function Document(fragments, options) { this.children = fragments || []; if (options) this.options = options; this.init(); }
function Fragment(sections, options) { this.children = sections || []; if (options) this.options = options; this.init(); }
function Section(paragraphs, options) { this.children = paragraphs || []; if (options) this.options = options; this.init(); }
function P(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Header(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Quote(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Ulli(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Olli(spans, opitons) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Code(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Figure(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Table(rows, options) { this.children = rows || []; if (options) this.options = options; this.init(); }
function Row(cells, options) { this.children = cells || []; if (options) this.options = options; this.init(); }
function Cell(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Link(spans, options) { this.children = spans || []; if (options) this.options = options; this.init(); }
function Strong(spans) { this.children = spans || []; this.init(); }
function Em(spans) { this.children = spans || []; this.init(); }
function Sub(spans) { this.children = spans || []; this.init(); }
function Sup(spans) { this.children = spans || []; this.init(); }

function Result() {} //TODO: make a result object that takes up one character

Document.prototype = new Element(Document, {space: '\n', type: 'document'})
Fragment.prototype = new Element(Fragment, {space: '\n', type: 'fragment'});
Section.prototype = new Element(Section, {space: '\n', type: 'section'});
P.prototype = new Element(P, {type: 'p', attribute: 'paragraph'});
Header.prototype = new Element(Header, {type: 'header', attribute: 'paragraph'});
Quote.prototype = new Element(Quote, {type: 'quote',attribute: 'paragraph'});
Ulli.prototype = new Element(Ulli, {type: 'ulli', attribute: 'paragraph'});
Olli.prototype = new Element(Olli, {type: 'olli', attribute: 'paragraph'});
Figure.prototype = new Element(Figure, {type: 'figure', attribute: 'paragraph'});
Code.prototype = new Element(Code, {type: 'code', attribute: 'paragraph'});
Table.prototype = new Element(Table, {space: '\n', type: 'table', attribute: 'paragraph'});
Row.prototype = new Element(Row, {space: '\t', type: 'row'});
Cell.prototype = new Element(Cell, {type: 'cell'});
Link.prototype = new Element(Link, {type: 'link'});
Strong.prototype = new Element(Strong, {type: 'strong'});
Em.prototype = new Element(Em, {type: 'em'});
//TODO: if these are mutually exculsive then we should make them one class with an option
Sub.prototype = new Element(Sub, {type: 'sub'});
Sup.prototype = new Element(Sup, {type: 'sup'}); //we don't allow sup sup

var LEVELS = {
	sup: 1,
	sub: 2,
	em: 3,
	strong: 4,
	link: 5,
	cell: 47,
	row: 48,
	paragraph: 50,
	section: 80,
	fragment: 90,
	document: 100,
};

var Constructors = Element._constructors;

function Mark(attribute, options, type) {
	this.attribute = attribute;
	this.options = options;
	this.klass = Constructors[type || attribute]
}
function EndMark(attribute) {
	this.attribute = attribute;
}
function UnMark(attribute, options, type) {
	this.attribute = attributes;
	this.options = options;
	this.type = type;
}
function UnEndMark(attribute) {
	this.attribute = attribute;
}
function Retain(n) {
	this.n = n;
}
function Skip(n) {
	this.n = n;
}

function Operation() {}
Mark.prototype = new Operation();
EndMark.prototype = new Operation();
UnMark.prototype = new Operation();
UnEndMark.prototype = new Operation();
Retain.prototype = new Operation();
Skip.prototype = new Operation();


function apply(doc, opsO) {
	var ops = opsO.slice(0).reverse();
	var chunks = [];
	var stack = [];
	var level = 10000; //sentinel level
	var op;
	var cursor = -1;

	function endMark(attribute) {
		var yard = [];
		var n;
		var tl = stack.pop();
		while(tl.op.attribute !== attribute) {
			n = new tl.op.klass(chunks, tl.op.options);
			chunks = tl.chunks;
			chunks.push(n);
			yard.push(tl);
			tl = stack.pop();
		};
		n = new tl.op.klass(chunks, tl.op.options);
		chunks = tl.chunks
		chunks.push(n);
		level = tl.level;
		while(tl = yard.pop()) {
			op = tl.op;
			stack.push({op: op, chunks: chunks, level: level});
			level = tl.level;
			chunks = [];
		}
	}

	function mark(op) {
		var yard = [];
		var n;
		var nl = LEVELS[op.attribute];
		while (nl >= level) {
			tl = stack.pop();
			level = tl.level;
			n = new tl.op.klass(chunks, tl.op.options);
			chunks = tl.chunks;
			chunks.push(n);
			yard.push(tl);
		}
		stack.push({op: op, chunks: chunks, level: level});
		chunks = [];
		level = nl;
		while(tl = yard.pop()) {
			op = tl.op;
			stack.push({op: op, chunks: chunks, level: level});
			level = tl.level;
			chunks = [];
		}
	}

	while ((op = ops.pop()) !== UNDEFINED) {
		if (op instanceof Retain) {
			var nops = doc.operationsForRange(cursor, cursor + op.n);
			for (var i = nops.length - 1; i >= 0; i--) {
				ops.push(nops[i]);
			};
			cursor += op.n;
		} else if (op instanceof Skip) {
			cursor += op.n;
		} else if (op instanceof Mark) {
			mark(op);
		} else if (op instanceof EndMark) {
			endMark(op.attribute);
		} else {
			//insert text (or object)
			chunks.push(op);
		}
	}

	//TODO: this should be an error.
	while (tl = stack.pop()) {
		console.log(tl.op);
		n = new tl.op.klass(chunks, tl.op.options);
		chunks = tl.chunks
		chunks.push(n);
	}

	return chunks[0];
}

var exDoc = new Document([
	new Fragment([new Section([
		new P(["This is a test"]),"\n",
		new P(),"\n",
		new P(["This is another test"]),
		])
	])
]);

var exA = [new Retain(1+15),
	new Mark('em', true), 
	"Some cool ", 
	new Mark('strong', true), 
	"Text", 
	new EndMark('em'),
	" that needs emphasis", 
	new EndMark('strong'), 
	". Followed by text that is just text",
	new Retain(exDoc.length + 1 - 15) //End
];

var exB = [new Retain(1),
	new Mark('em', true), 
	"Some cool ", 
	new Mark('strong', true),
	"Text", 
	new EndMark('strong'), 
	" that needs emphasis", 
	new EndMark('em'), 
	". Followed by text that is just text",
	new Retain(exDoc.length + 1) //End
];

'\n' + 
JSON.stringify(apply(exDoc, exA)) + '\n' + 
JSON.stringify(apply(exDoc, exB)) + '\n';
