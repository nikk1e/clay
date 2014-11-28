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
	if (start <= 0) {
		if (end > this.length) {
			ops.push(this); 
			return ops; //range covers whole element
		} else if (end > 0) {
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
			if (cursor >= start && child.length < len) {
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

Document.prototype = new Element(Document, {type: 'document'});
Fragment.prototype = new Element(Fragment, {type: 'fragment'});
Section.prototype = new Element(Section, {type: 'section'});
P.prototype = new Element(P, {type: 'p', attribute: 'paragraph'});
Header.prototype = new Element(Header, {type: 'header', attribute: 'paragraph'});
Quote.prototype = new Element(Quote, {type: 'quote',attribute: 'paragraph'});
Ulli.prototype = new Element(Ulli, {type: 'ulli', attribute: 'paragraph'});
Olli.prototype = new Element(Olli, {type: 'olli', attribute: 'paragraph'});
Figure.prototype = new Element(Figure, {type: 'figure', attribute: 'paragraph'});
Code.prototype = new Element(Code, {type: 'code', attribute: 'paragraph'});
Table.prototype = new Element(Table, {type: 'table', attribute: 'paragraph'});
Row.prototype = new Element(Row, {type: 'row'});
Cell.prototype = new Element(Cell, {type: 'cell'});
Link.prototype = new Element(Link, {type: 'link'});
Strong.prototype = new Element(Strong, {type: 'strong'});
Em.prototype = new Element(Em, {type: 'em'});
Sub.prototype = new Element(Sub, {type: 'sub', attribute: 'supb'});
Sup.prototype = new Element(Sup, {type: 'sup', attribute: 'supb'});

var LEVELS = {
	supb: 2,
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
	this.type = type;
}
function EndMark(attribute) {
	this.attribute = attribute;
}
function UnMark(attribute, options, type) {
	this.attribute = attribute;
	this.options = options;
	this.type = type;
}
function UnEndMark(attribute) {
	this.attribute = attribute;
}
function Retain(n) {
	this.n = n;
	this.inputLen = n;
}
function Skip(str) {
	this.str = str;
	this.inputLen = str.length;
}
function Insert(str) {
	this.str = str;
	this.length = str.length;
}

function Operation() {
	this.inputLen = 0;
}

Mark.prototype = new Operation();
EndMark.prototype = new Operation();
UnMark.prototype = new Operation();
UnEndMark.prototype = new Operation();
Retain.prototype = new Operation();
Skip.prototype = new Operation();
Insert.prototype = new Operation();

Mark.prototype.invert = function() {
	return new UnMark(this.attribute, this.options, this.type);
};
EndMark.prototype.invert = function() {
	return new UnEndMark(this.attribute);
};
UnMark.prototype.invert = function() {
	return new Mark(this.attribute, this.options, this.type);
};
UnEndMark.prototype.invert = function() {
	return new EndMark(this.attribute);
};
Retain.prototype.invert = function() {
	return this;
};
Skip.prototype.invert = function() {
	return new Insert(this.str);
};
Insert.prototype.invert = function() {
	return new Skip(this.str);
};

function Operations(ops) {
	this.ops = ops || [];
	this.inputLen = 0;
	for (var i = this.ops.length - 1; i >= 0; i--) {
		this.inputLen += this.ops[i].inputLen;
	};
}
Operations.prototype.push = function(op) { 
	this.inputLen += op.inputLen;
	this.ops.push(op);
};
Operations.prototype.retain = function(n) { 
	this.push(new Retain(n)); 
	return this;
};
Operations.prototype.skip = function(str) { 
	this.push(new Skip(str)); 
	return this;
};
Operations.prototype.end = function(doc) {
	if (doc.length >= this.inputLen) 
		this.retain(doc.length - this.inputLen + 1); 
	return this;
};
Operations.prototype.mark = function(attribute, options, type) { 
	this.push(new Mark(attribute, options, type)); 
	return this;
};
Operations.prototype.endmark = function(attribute) { 
	this.push(new EndMark(attribute)); 
	return this;
};
Operations.prototype.unmark = function(attribute, options, type) { 
	this.push(new UnMark(attribute, options, type)); 
	return this;
};
Operations.prototype.unendmark = function(attribute) { 
	this.push(new UnEndMark(attribute)); 
	return this;
};
Operations.prototype.insert = function(str) { 
	this.push(new Insert(str)); 
	return this;
};
Operations.prototype.invert = function() {
	return new Operations(this.ops.map(function(op) {
		return op.invert();
	}));
};
Operations.prototype.apply = function(doc) {
	return apply(doc, this.ops);
};
//left is if the data is from the client or server
// server sends back ops that should come before the
// op you sent so you can transform them
// with your ops (and the opposite left to the server).
Operations.prototype.transform = function(otherOps, left) {
	var newOps = new Operations();

	var ops = this.ops;

	var ia = 0;
	var io = 0;
	var offset = 0; //used in take
	var component;

	function take(n, indivisableField) {
		if (ia === ops.length)
			return n === -1 ? null : new Retain(n);

		var part;
		var c = ops[ia];
		if (c instanceof Retain) {
			if (n === -1 || c.n - offset <= n) {
				part = new Retain(c.n - offset);
				++ia;
				offset = 0;
				return part;
			} else {
				offset += n;
				return new Retain(n);
			}
		} else if (c instanceof Insert) {
			 if (n === -1 || indivisableField === 'i' || c.length - offset <= n) {
			 	part = new Insert(c.str.slice(offset));
			 	++ia;
			 	offset = 0;
			 	return part;
			 } else {
			 	part = new Insert(c.str.slice(offset, offset + n));
			 	offset += n;
			 	return part;
			 }
		} else if (c instanceof Skip) {
			if (n === -1 || indivisableField === 'd' || c.inputLen - offset <= n) {
				part = new Skip(c.str.slice(offset, offset + n));
				++ia;
				offset = 0;
				return part;
        	} else {
        		part = new Skip(c.str.slice(offset, offset + n));
			 	offset += n;
			 	return part;
			}
		} else {
			offset = 0;
			++ia;
			return c; //mark/endmark/unmark/unendmark
		}
	}

	var marks = {};
	var endMarks = {};
	var unMarks = {};
	var x;
	for (io = 0; io < otherOps.ops.length; io++) {
		var opo = otherOps.ops[io];
		var length, chunk;
		if (opo instanceof Retain) {
			length = opo.n;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				if (chunk instanceof Mark) {
					if (endMarks[chunk.attribute]) {
						newOps.push(chunk);
						delete endMarks[chunk.attribute];
					} else if ((x = marks[chunk.attribute])) {
						if ((x.options !== chunk.options || //TODO: object compare
							x.type !== chunk.type) && !left) {
							//Different and "~left" so they came first
							//meaning we need to end them
							//and put us in their place
							newOps.endmark(chunk.attribute);
							endMarks[chunk.attribute] = x;
							delete marks[chunk.attribute];
						} else {
							//same or "left" so we came first
							unMarks[chunk.attribute] = chunk;
						}
					} else {
						marks[chunk.attribute] = chunk;
						newOps.push(chunk);
					}
				} else if (chunk instanceof EndMark) {
					if (endMarks[chunk.attribute]) {
						delete endMarks[chunk.attribute];
					} else if (marks[chunk.attribute]) {
						newOps.push(chunk);
						delete marks[chunk.attribute];
					} else {
						newOps.push(chunk);
						endMarks[chunk.attribute] = true;
					}
					//NOTE: this is relying on cancelling
					//but is correct.
					if (unMarks[chunk.attribute]) {
						//put the other item back
						newOps.push(unMarks[chunk.attribute]);
						delete unMarks[chunk.attribute];
					}
				} else if (chunk instanceof UnMark) {
					newOps.push(chunk); //TODO
				} else if (chunk instanceof UnEndMark) {
					newOps.push(chunk); //TODO
				} else {
					newOps.push(chunk); //append(chunk);
				}
				length -= chunk.inputLen;
			}
		} else if (opo instanceof Insert) {
			if (left && ops[ia] instanceof Insert) {
				newOps.push(take(-1)); //left insert goes first;
			}
			newOps.retain(opo.length); //skip the inserted text
		} else if (opo instanceof Skip) {
			length = opo.inputLen;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				if (chunk instanceof Retain) {
					length -= chunk.n;
				} else if (chunk instanceof Insert) {
					newOps.push(chunk);
				} else if (chunk instanceof Skip) {
					length -= chunk.inputLen;
				} else if (chunk instanceof Mark) {
					if (endMarks[chunk.attribute]) {
						newOps.push(chunk);
						delete endMarks[chunk.attribute];
					} else {
						marks[chunk.attribute] = chunk;
						newOps.push(chunk);
					}
				} else if (chunk instanceof EndMark) {
					if (endMarks[chunk.attribute]) {
						delete endMarks[chunk.attribute];
					} else if (marks[chunk.attribute]) {
						newOps.push(chunk);
						delete marks[chunk.attribute];
					} else {
						newOps.push(chunk);
						endMarks[chunk.attribute] = chunk;
					}
					if (unMarks[chunk.attribute]) {
						//put the other item back
						newOps.push(unMarks[chunk.attribute]);
						delete unMarks[chunk.attribute];
					}
				} else if (chunk instanceof UnMark) {
					newOps.push(chunk); //TODO:
				} else if (chunk instanceof UnEndMark) {
					newOps.push(chunk); //TODO:
				}
			}
		} else if (opo instanceof Mark) {
			//TODO: this doesn't cover 
			// anywhere near all the orderings
			if ((x = marks[opo.attribute])) {
				if ((x.options !== opo.options || //TODO: object compare
					x.type !== opo.type) && left) {
					//Different and "left" so we came first
					//meaning we need to end ourselves
					//so the other stays in place
					newOps.endmark(opo.attribute);
					endMarks[opo.attribute] = x;
					delete marks[opo.attribute];
				} else {
					//same or "~left" so they came first
					//so we need to remove their mark
					//so our mark continues
					newOps.unmark(opo.attribute, opo.options, opo.type);
					unMarks[opo.attribute] = opo;
				}
			} else {
				marks[opo.attribute] = opo;
			}
		} else if (opo instanceof EndMark) {
			if (unMarks[opo.attribute]) {
				newOps.unendmark(opo.attribute);
				delete unMarks[opo.attribute];
			}
		} else if (opo instanceof UnMark) {
			//TODO
		} else if (opo instanceof UnEndMark) {
			//TODO
		}
	}

	while ((component = take(-1)))
		newOps.push(component);

	return newOps;
};
Operations.prototype.compose = function(other) {
	//TODO: implement
};

var shouldMerge = {
	supb: true,
	em: true,
	strong: true,
	link: true,
};

function apply(doc, opsO) {
	var ops = [];
	var chunks = [];
	var stack = [];
	var level = 10000; //sentinel level
	var op;
	var cursor = 0;
	var unMarks = {};
	var unEndMarks = {};
	unMarks.length = 0;
	unEndMarks.length = 0;
	var marks = {};
	var endMarks = {};

	function endMark(attribute) {
		var yard = [];
		var n;
		var klass;
		var tl = stack.pop();
		while(tl.op.attribute !== attribute) {
			klass = Constructors[tl.op.type || tl.op.attribute];
			n = new klass(chunks, tl.op.options);
			chunks = tl.chunks;
			chunks.push(n);
			yard.push(tl);
			tl = stack.pop();
		};
		klass = Constructors[tl.op.type || tl.op.attribute];
		n = new klass(chunks, tl.op.options);
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
		var n, klass;
		var nl = LEVELS[op.attribute];
		while (nl >= level) {
			tl = stack.pop();
			level = tl.level;
			if (chunks.length > 0) {
				klass = Constructors[tl.op.type || tl.op.attribute];
				n = new klass(chunks, tl.op.options);
				chunks = tl.chunks;
				chunks.push(n);
			} else {
				chunks = tl.chunks;
			}
			
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

	function processMarks() {
		if (unMarks.length > 0)
			throw "UnMark with no matching mark";
		if (unEndMarks.length > 0)
			throw "UnEndMark with no matching endMark";
		//do endMarks
		for (var attribute in endMarks) {
			if (endMarks.hasOwnProperty(attribute)) {
				endMark(attribute);
			}
		}
		endMarks = {};
		//do marks
		for (var attribute in marks) {
			if (marks.hasOwnProperty(attribute)) {
				mark(marks[attribute]);
			}
		}
		marks = {};
	}

	//expand all the retains.
	for (var i = 0; i < opsO.length; i++) {
		op = opsO[i];
		if (op instanceof Retain) {
			var nops = doc.operationsForRange(cursor, cursor + op.n);
			for (var j = 0; j < nops.length; j++) {
				ops.push(nops[j]);
			};
			cursor += op.n;
		} else if (op instanceof Skip) {
			//all the Mark and EndMarks need to net off.
			var nops = doc.operationsForRange(cursor, cursor + op.str.length);
			for (var j = 0; j < nops.length; j++) {
				if (nops[j] instanceof Mark || nops[j] instanceof EndMark)
					ops.push(nops[j]);
			};
			cursor += op.str.length;
		} else {
			ops.push(op);
		}
	};

	for (var i = 0; i < ops.length; i++) {
		op = ops[i];
		//keep track of all the marks and unmarks
		// but only actually process them when we move
		// the cursor on. That we we can cancel them out
		// when they match off.
		// TODO: this doesn't really work for 
		// unMark then mark...
		if (op instanceof Mark) {
			if (unMarks[op.attribute]) {
				delete unMarks[op.attribute];
				unMarks.length -= 1;
			} else if (endMarks[op.attribute] && shouldMerge[op.attribute]) {
				delete endMarks[op.attribute];
			} else if (marks[op.attribute]) {
				throw "Mark " + op.attribute + " already set."
			} else {
				marks[op.attribute] = op;
			}
		} else if (op instanceof UnMark) {
			if (marks[op.attribute]) {
				delete marks[op.attribute];
			} else if (unMarks[op.attribute]) {
				throw "UnMark " + op.attribute + " already set.";
			} else {
				unMarks[op.attribute] = op;
				unMarks.length += 1;
			}
		} else if (op instanceof UnEndMark) {
			if (endMarks[op.attribute]) {
				delete endMarks[op.attribute];
			} else if (unEndMarks[op.attribute]) {
				throw "UnEndMark " + op.attribute + " already set.";
			} else {
				unEndMarks[op.attribute] = op;
				unEndMarks.length += 1;
			}
		} else if (op instanceof EndMark) {
			if (unEndMarks[op.attribute]) {
				delete unEndMarks[op.attribute];
				unEndMarks.length -= 1;
			} else if (marks[op.attribute] && shouldMerge[op.attribute]) {
				delete marks[op.attribute];
			} else if (endMarks[op.attribute]) {
				throw "EndMark " + op.attribute + " already set."
			} else {
				endMarks[op.attribute] = op;
			}
		} else {
			processMarks();
			if (op instanceof Insert) {
				if (typeof chunks[chunks.length - 1] === 'string' &&
					!(chunks.length === 1 && 
						(chunks[0] === '\n' || chunks[0] === '\t')))
					chunks[chunks.length - 1] += op.str;
				else
					chunks.push(op.str);
			} else {
				if (typeof op === 'string' && 
					typeof chunks[chunks.length - 1] === 'string' &&
					!(chunks.length === 1 && 
						(chunks[0] === '\n' || chunks[0] === '\t')))
					chunks[chunks.length - 1] += op;
				else
					chunks.push(op);
			}
		}
	};

	processMarks();

	if (stack.length > 0) throw "Non empty stack at end of apply";

	return chunks[0];
}

var exDoc = new Document([
	new Fragment([new Section([
		new P(["\n","This is a test"]),
		new P(["\n"]),
		new P(["\n","This is another test"]),
		])
	])
]);

var exA = new Operations([new Retain(1+15),
	new Mark('em', true), 
	new Insert("Some cool "), 
	new Mark('strong', true), 
	new Insert("Text"), 
	new EndMark('em'),
	new Insert(" that needs emphasis"), 
	new EndMark('strong'), 
	new Insert(". Followed by text that is just text"),
]).end(exDoc);

var exB = new Operations([new Retain(1),
	new Mark('em', true), 
	new Insert("Some cool "), 
	new Mark('strong', true),
	new Insert("Text"), 
	new EndMark('strong'), 
	new Insert(" that needs emphasis"), 
	new EndMark('em'), 
	new Insert(". Followed by text that is just text")
]).end(exDoc);

var exC = new Operations([new Retain(1+14),
	new UnEndMark('paragraph'),
	new UnMark('paragraph',undefined,'p'),
	new Skip('\n'), //remove the 
	new Mark('em', true), 
	new Insert("Some cool "),
	new UnMark('strong', true),
	new Mark('strong', true),
	new Insert("Text"),
	new EndMark('em'),
	new Insert(" that needs emphasis"),
	new UnEndMark('strong'),
	new EndMark('strong'),
	new Insert(". Followed by text that is just text"),
	//new Retain(exDoc.length + 1 - 13) //End
	new Retain(5),
	new Retain(5),
	new Retain(5),
	new Retain(5),
	new Retain(5),
]);

'\n' + 
JSON.stringify(exA.apply(exDoc)) + '\n' + 
JSON.stringify(exB.apply(exDoc)) + '\n' + 
JSON.stringify(exC.apply(exDoc)) + '\n';

JSON.stringify(exC.invert().apply(exC.apply(exDoc))) === JSON.stringify(exDoc)


var tDoc = new Document(["This is a test string."]);


//Test Insert
var tA = new Operations().retain(10).insert('very very good ').end(tDoc);
var tB = new Operations().retain(10).insert('absolutely awesome ').end(tDoc);

var tAprime = tA.transform(tB);
var tBprime = tB.transform(tA, true);

console.log(tBprime.apply(tA.apply(tDoc)).textContent() === 
	tAprime.apply(tB.apply(tDoc)).textContent())

//Test Skip
var tA = new Operations().retain(5).skip('is a test ')
	.retain(6).insert(' I like the look of').end(tDoc);
var tB = new Operations().retain(10).skip('test ').end(tDoc);

var tAprime = tA.transform(tB);
var tBprime = tB.transform(tA, true);

console.log(tBprime.apply(tA.apply(tDoc)).textContent() === 
	tAprime.apply(tB.apply(tDoc)).textContent())


//Test Mark/EndMark
var tA = new Operations().retain(5)
	.mark('strong', true).retain(6)
	.endmark('strong', true).end(tDoc);
var tB = new Operations().retain(10)
	.mark('strong', true).retain(4)
	.endmark('strong', true).end(tDoc);

JSON.stringify(tA.apply(tDoc)) + '\n' +
JSON.stringify(tB.apply(tDoc));
var tAprime = tA.transform(tB);
var tBprime = tB.transform(tA, true);

console.log(tBprime.apply(tA.apply(tDoc)).textContent() === 
	tAprime.apply(tB.apply(tDoc)).textContent())

JSON.stringify(tAprime.apply(tB.apply(tDoc))) + '\n' +
JSON.stringify(tBprime.apply(tA.apply(tDoc)));

//Test Mark/EndMark (overlapped) This is a test string.
var tA = new Operations().retain(6)
	.mark('strong', true).retain(7)
	.endmark('strong', true).end(tDoc);
var tB = new Operations().retain(8)
	.mark('strong', true).retain(1)
	.endmark('strong', true).end(tDoc);

JSON.stringify(tA.apply(tDoc)) + '\n' +
JSON.stringify(tB.apply(tDoc));
var tAprime = tA.transform(tB);
var tBprime = tB.transform(tA, true);

console.log(tBprime.apply(tA.apply(tDoc)).textContent() === 
	tAprime.apply(tB.apply(tDoc)).textContent())

JSON.stringify(tAprime.apply(tB.apply(tDoc))) + '\n ' +
JSON.stringify(tBprime.apply(tA.apply(tDoc)));


//Test unmark/mark && unendmark/unmark

var tDoc2 = new Document([new P(["\nThis is a"]),new P(["\ntest string."])]);

var tA = new Operations().retain(10)
	.unendmark('paragraph').unmark('paragraph',undefined, 'p').skip('\n').end(tDoc2);
var tB = new Operations().unmark('paragraph',undefined, 'p')
	.mark('paragraph', { someOption: true }, 'p').end(tDoc2);

JSON.stringify(tA.apply(tDoc2)) + '\n' +
JSON.stringify(tB.apply(tDoc2));
var tAprime = tA.transform(tB);
var tBprime = tB.transform(tA, true); //TODO: this is not working

console.log(tBprime.apply(tA.apply(tDoc2)).textContent() === 
	tAprime.apply(tB.apply(tDoc2)).textContent())

JSON.stringify(tAprime.apply(tB.apply(tDoc2))) + '\n ' +
JSON.stringify(tBprime.apply(tA.apply(tDoc2)));