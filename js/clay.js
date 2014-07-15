/**
 * clay - computable document format.
 * Copyright (c) 2014, Benjamin Norrington (MIT Licensed)
 *
 * Based on: marked.js
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed) 
 * https://github.com/chjj/marked
 */

;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^((?: {4}|\t)[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^( *(#{1,6}) *)([^\n]+?)( *#* *(?:\n+|$))/,
  meta: /^%(\w+) *([^ ][^\n]*)?(\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^(?: *)bull ([^\n]*(?:\n(?!\1bull )[^\n]*)*)/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
  ('def', '\\n+(?=' + block.def.source + ')')
  ();

block.blockquote = replace(block.blockquote)
  ('def', block.def)
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

/**
 * Normal Block Grammar
 */

block.normal = merge({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = merge({}, block.normal, {
  fences: /^( *(`{3,}|~{3,}) *(\S+)? *)\n([\s\S]+?\n)(\s*\2 *(?:\n+|$))/,
  paragraph: /^/
});

block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!'
    + block.gfm.fences.source.replace('\\1', '\\2') + '|'
    + block.list.source.replace('\\1', '\\3') + '|')
  ();

/**
 * GFM + Tables Block Grammar
 */

block.tables = merge({}, block.gfm, {
  nptable: /^( *\S.*\|.*)\n( *[-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)(\n*)/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || clay.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n') //TODO this needs to move to inbound
    //.replace(/\t/g, '    ') //TODO replace this
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  this.token(src, true);
  this.tokens.push({type:'EOF'});
  return this.tokens;
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top, bq, pos) {
  var src = src.replace(/^( {1,3})(\t+)/gm, '$2$1') //TODO.. This will result in funny indent outdent
    , next
    , loose
    , cap
    , bull
    , b
    , item
    , space
    , i
    , l
    , matchlen;
    pos = pos || 0;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      //if (cap[0].length > 1) {
      this.tokens.push({type: 'space', pos: pos, text: cap[0]});
      //}
      pos += matchlen;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      cap = cap[0];
      this.tokens.push({
        type: 'code',
        text: !this.options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap,
        pos: pos
      });
      pos += matchlen;
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.push({
        type: 'code',
        lang: cap[3],
        text: cap[4],
        before: cap[1], 
        after: cap[5].slice(0,-1),
        pos: pos,
      });
      pos += matchlen;
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      var after = cap[4].slice(0,-1);
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      var t = {
        type: 'heading',
        id: cap[3].toLowerCase().replace(/[^\w]+/g, '-'),
        depth: cap[2].length,
        children: [{type: 'before', text: cap[1], pos: pos}
                  ,{type: 'text', text: cap[3], pos: pos + cap[1].length}],
        pos: pos
      };
      this.tokens.push(t);
      if (after.length > 0)
        t.children.push({type: 'after', text: after, pos: pos + cap[1].length + cap[3].length});
      pos += matchlen;
      continue;
    }

    // meta
    if (cap = this.rules.meta.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.push({
        type: 'meta',
        head: cap[1],
        value: cap[2],
        text: cap[0].slice(0,-1),
        pos: pos
      });
      pos += matchlen;
      continue;
    }


    // table no leading pipe (gfm) -- assuming no trailing pipes either
    if (top && (cap = this.rules.nptable.exec(src))) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);

      var a = cap[3].match(/\n*$/);


      item = {
        type: 'table',
        header: cap[1].split(/\|/), //replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].split(/\|/), //.replace(/^ *|\| *$/g, '').split(/ *\| */),
        alignText: cap[2].split(/\|/), 
        cells: cap[3].slice(0,a.index).split('\n'),
        after: a[0] + cap[4],
        pos: pos
      };

      item.align.pos = pos + cap[1].length + 1;
      item.cells.pos = item.align.pos + cap[2].length + 1;

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      var rpos = pos + cap[1].length + cap[2].length + 2, rlength, cpos = 0;

      //TODO replace with inner parse
      item.header = item.header.map(function(c) {
          var cw = c.length,
              cp = {text: c, pos: cpos+pos};
          cp.pos = cpos + pos;
          cpos += cw + 1;
          return cp; 
        });

      for (i = 0; i < item.cells.length; i++) {
        rlength = item.cells[i].length;
        cpos = 0;
        //TODO replace with inner parse
        item.cells[i] = item.cells[i].split(/\|/).map(function(c) {
          var cw = c.length,
              cp = {text: c, pos: cpos + rpos};
          cp.pos = cpos + rpos;
          cpos += cw + 1;
          return cp; 
        });
        item.cells[i].pos = rpos;
        rpos += rlength + 1;
      }

      this.tokens.push(item);
      pos += matchlen;
      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        children: [{type: 'text', text: cap[1], pos: pos},
                   {type: 'after', pos: pos + cap[1].length, text: cap[0].slice(cap[1].length,-1)}], 
        pos: pos
      });
      pos += matchlen;
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.push({
        type: 'hr',
        pos: pos,
        text: cap[0],
      });
      pos += matchlen;
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);

      var m = cap[0].match(/^ *> ?/gm);
      this.tokens.push({
        type: 'blockquote_start',
        pos: pos,
        before: m[0],
      });
      cap = cap[0].slice(m[0].length);

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top, true, pos + m[0].length);

      this.tokens.push({
        type: 'blockquote_end',
        pos: pos
      });
      pos += matchlen;
      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1,
        pos: pos
      });

      // Get each top-level item.
      //cap = cap[0].match(this.rules.item);
      var x = cap[0].match(this.rules.item);

      next = false;

      var all = cap[0];
      var ipos, lastI, i = 0, l = x.length, item;
      this.rules.item.lastIndex = 0;
      while ((item = this.rules.item.exec(all)) != null) {
        var before = item[0].substring(0,item[0].length - item[1].length);
        lastI = this.rules.item.lastIndex; //Save (and restore) lastIndex
        ipos = item.index + pos;
        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item[0].length;
        item = item[1]; //with bullet removed

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i + 1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src; //TODO: this is wrong if we do it the way we are doing it
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.

        //TODO: This is not working because of the l problem
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose
            ? 'loose_item_start'
            : 'list_item_start',
          pos: ipos,
          before: before,
        });
        // Recurse.
        this.token(item, false, bq, ipos + before.length);

        this.tokens.push({
          type: 'list_item_end'
        });
        this.rules.item.lastIndex = lastI;
        i += 1;
      }


      this.tokens.push({
        type: 'list_end'
      });


      pos += matchlen;
      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: cap[0],
        pos: pos
      });
      pos += matchlen;
      continue;
    }

    // def
    if ((!bq && top) && (cap = this.rules.def.exec(src))) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3],
        pos: pos
      };
      pos += matchlen;
      continue;
    }

    // table (gfm)
    //TODO: fix this type of table...
    if (top && (cap = this.rules.table.exec(src))) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n'),
        pos: pos
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);
      pos += matchlen;
      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      var after = cap[0].match(/\n*$/)[0].slice(1),
          text = cap[1].charAt(cap[1].length - 1) === '\n'
          ? cap[1].slice(0, -1)
          : cap[1];
      this.tokens.push({
        type: 'paragraph',
        text: text,
        after: after,
        pos: pos
      });
      pos += matchlen;
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      // Top-level should never reach here.
      matchlen = cap[0].length;
      src = src.substring(matchlen);
      this.tokens.push({
        type: 'text',
        text: cap[0],
        pos: pos
      });
      pos += matchlen;
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }
  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  escaped: /^&(#?\w+;)/,
  math: /^\\([a-zA-Z]+)\b( )?/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`&]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

var math = {
  'in':      '\u2208',
  'notin':   '\u2209',
  'oplus':   '\u2295',
  'ne':      '\u2260',
  'neq':     '\u2260',
  'leq':     '\u2264',
  'geq':     '\u2265',
  'wedge':   '\u2227',
  'vee':     '\u2228',

  'alpha':   '\u03b1',
  'beta':    '\u03b2',
  'gamma':   '\u03b3',
  'delta':   '\u03b4',
  'epsilon': '\u03b5',
  'pi':      '\u03c0',
  'bar':     '\u0304',
  'rightarrow': '\u2192',

  'neg':     '\u00ac',
  'lnot':    '\u00ac',
};

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || clay.defaults;
  this.links = links;
  this.rules = inline.normal;
  this.math = math;
  this.renderer = this.options.renderer || new Renderer;
  this.renderer.options = this.options;

  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src, 0);
};


/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src, pos) {
  var aout = []
    , link
    , text
    , href
    , out
    , cap;

  while (src) {
    // escape
    if (cap = this.rules.escape.exec(src)) {
      src = src.substring(cap[0].length);
      aout.push({type: 'before', text: '\\', pos: pos});
      aout.push({type: 'escape', text: cap[1], pos: pos + 1});
      //out += cap[1];
      pos += cap[0].length;
      continue;
    }

    //escaped
    if (cap = this.rules.escaped.exec(src)) {
      src = src.substring(cap[0].length);
      aout.push({type: 'escape', text: cap[0], pos: pos});
      aout.push({type: 'after', text: cap[1], pos: pos+1});
      //out += cap[1];
      pos += cap[0].length;
      continue;
    }

    //math
    if (cap = this.rules.math.exec(src)) {
      if (this.math.hasOwnProperty(cap[1])) {
        src = src.substring(cap[0].length);
        aout.push({type: 'escape', text: this.math[cap[1]], pos: pos});
        aout.push({type: 'after', text: cap[1] + (cap[2]||''), pos: pos+1});
        //out += cap[1];
        pos += cap[0].length;
        continue;
      }
    }

    // autolink
    if (cap = this.rules.autolink.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[2] === '@') {
        text = cap[1].charAt(6) === ':'
          ? this.mangle(cap[1].substring(7))
          : this.mangle(cap[1]);
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      aout.push({type: 'a', href: href, children: [{type: 'text', text: 'UNSUPPORTED autolink', pos: pos}], pos: pos});
      pos += cap[0].length;
      //out += this.renderer.link(href, null, text);
      continue;
    }

    // url (gfm)
    if (!this.inLink && (cap = this.rules.url.exec(src))) {
      src = src.substring(cap[0].length);
      text = escape(cap[1]);
      href = text;
      aout.push({type: 'a', children: [{type: 'text', text: 'UNSUPPORTED url (gfm)', pos: pos}], pos: pos});
      pos += cap[0].length;
      //out += this.renderer.link(href, null, text);
      continue;
    }

    // tag
    if (cap = this.rules.tag.exec(src)) {
      if (!this.inLink && /^<a /i.test(cap[0])) {
        this.inLink = true;
      } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
        this.inLink = false;
      }
      src = src.substring(cap[0].length);
      aout.push({type: 'text', text: 'UNSUPPORTED tag ' + cap[0], pos: pos});
      pos += cap[0].length;
      //out += this.options.sanitize
      //  ? escape(cap[0])
      //  : cap[0];
      continue;
    }

    // link
    if (cap = this.rules.link.exec(src)) {
      src = src.substring(cap[0].length);
      this.inLink = true;
      aout.push(this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      }, pos));
      pos += cap[0].length;
      this.inLink = false;
      continue;
    }

    // reflink, nolink
    if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out += cap[0].charAt(0);
        src = cap[0].substring(1) + src;
        aout.push({type: 'a', href: '#', 
          children: [{type: 'text', text: 'UNSUPPORTED reflink/nolink thingy', pos: pos}], pos: pos});
      } else {
        this.inLink = true;
        aout.push(this.outputLink(cap, link, pos));
        this.inLink = false;
      }
      pos += cap[0].length;
      continue;
    }

    // strong
    if (cap = this.rules.strong.exec(src)) {
      src = src.substring(cap[0].length);
      out = {type: 'strong', children: this.output(cap[2] || cap[1], pos+2), pos: pos};
      out.children.unshift({type: 'before', text: '**', pos: pos});
      out.children.push({type: 'after', text: '**', pos: pos + cap[0].length - 2})
      aout.push(out);
      pos += cap[0].length;
      continue;
    }

    // em
    if (cap = this.rules.em.exec(src)) {
      src = src.substring(cap[0].length);
      out = {type: 'em', children: this.output(cap[2] || cap[1], pos+1), pos: pos};
      out.children.unshift({type: 'before', text: '*', pos: pos});
      out.children.push({type: 'after', text: '*', pos: pos + cap[0].length - 1})
      aout.push(out);
      pos += cap[0].length;
      continue;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      out = {type: 'codespan', text: cap[2], pos: pos}
      out.sexpr = clay.code(cap[2], false);
      out.result = clay.code.show(out.sexpr); //TODO: replace with real evaluate
      aout.push(out); //TODO + length of backticks
      pos += cap[0].length;
      continue;
    }

    // br
    if (cap = this.rules.br.exec(src)) {
      src = src.substring(cap[0].length);
      aout.push({type: 'br', text: cap[0], pos: pos}); 
      pos += cap[0].length;
      continue;
    }

    // del (gfm)
    if (cap = this.rules.del.exec(src)) {
      src = src.substring(cap[0].length);
      out = {type: 'del', children: this.output(cap[2] || cap[1], pos+2), pos: pos};
      out.children.unshift({type: 'before', text: '~~', pos: pos});
      out.children.push({type: 'after', text: '~~', pos: pos + cap[0].length - 2})
      aout.push(out); 
      pos += cap[0].length;
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      src = src.substring(cap[0].length);
      aout.push({type: 'text', text: this.smartypants(cap[0]), pos: pos}); 
      pos += cap[0].length;
      //out += escape(this.smartypants(cap[0]));
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return aout;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link, off) {
  var href = escape(link.href)
    , title = link.title ? escape(link.title) : null;

  return cap[0].charAt(0) !== '!'
    ? {type: 'a', href: href, title: title, children: this.output(cap[1], off), pos: off}
    : {type: 'img', href: href, title: title, alt: cap[1], pos: off};
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    // em-dashes
    .replace(/--/g, '\u2014')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026');
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Renderer
 */

function Renderer(options) {
  this.options = options || {};
}

Renderer.prototype.br = function() {
  return this.options.xhtml ? '<br/>' : '<br>';
};


Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0) {
      return '';
    }
  }
  var out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += '>' + text + '</a>';
  return out;
};

Renderer.prototype.image = function(href, title, text) {
  var out = '<img src="' + href + '" alt="' + text + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += this.options.xhtml ? '/>' : '>';
  return out;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || clay.defaults;
  this.options.renderer = this.options.renderer || new Renderer;
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;
}

Parser.parse = function(src, options, renderer) {
  var parser = new Parser(options, renderer);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options, this.renderer);
  this.tokens = src.reverse();
  return this.parseProg();
};

Parser.prototype.parseProg = function() {
  var out = [];
  while (this.next()) {
    var item = this.tok(); // match anything at top level
    if (item)
      out.push(item)
  };
  return out;
}

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length - 1] || 0;
};


Parser.prototype.poke = function() {
  this.tokens.push(this.token);
};
/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function(pos) {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body, pos);
};

/**
 * Parse Current Token
 */

Parser.prototype.parseSection = function() {
  var level = this.token.depth,
      item = null,
      ret = {type: 'section'
            ,pos: this.token.pos
            ,children: [this.token] 
            };
  while (this.next()) {
    if (this.token.type === 'heading' && this.token.depth <= level) {
      this.poke();
      return ret;
    }
    item = this.tok(item || ret);
    if (item)
      ret.children.push(item);
  }
  return ret;
};

Parser.prototype.parseCode = function() {
  var lines = this.token.text.split('\n'),
      index = 0,
      pos = this.token.pos,
      children = [], i, l = lines.length;
  if (this.token.before !== undefined) {
    children.push({type: 'before', pos: pos, text: this.token.before, newline: true});
    pos += this.token.before.length + 1
    children.push({type: 'text', pos: pos, text: this.token.text});
  }
  else {
    for (i = 0; i < l; i++) {
      var line = lines[i] + '\n',
        m = /^( {4}|\t)?(.*\n?)$/m.exec(line);
      if (m) {
        children.push({type: 'span', 
          pos: pos + index, 
          children: [{type: 'before', pos: pos + index, text: m[1]}
                  ,{type: 'text', pos: pos + index + m[1].length, text: m[2]}]});
      } else {
        console.log('Error: m is null for line: ' + line);
      }
      index += line.length;
    }
  }
  if (this.token.after !== undefined)
    children.push({type: 'after', pos: pos + this.token.text.length, text: this.token.after})
  this.token.children = children;
  if (this.token.lang === undefined) {
    this.token.sexpr = clay.code(this.token.text.replace(/^( {4}|\t)/gm,''), true);
    this.token.result = clay.code.showp(this.token.sexpr).split('\n'); //TODO: replace with real evaluate
  }
  return this.token;
}

Parser.prototype.parseTable = function() {
  //
  var inline = this.inline;
  this.token.header = this.token.header.map(function(t) {
    var h = inline.output(t.text, t.pos);
    h.pos = t.pos;
    return h;
  });
  var c = this.token.cells.map(function(row) {
    var r = row.map(function(cell) {
      var c = inline.output(cell.text, cell.pos);
      c.pos = cell.pos;
      return c;
    });
    r.pos = row.pos;
    return r;
  })
  c.pos = this.token.cells.pos;
  this.token.cells = c;
  return this.token;
}


Parser.prototype.tok = function(prev) {
    switch (this.token.type) {
      case 'EOF': return;
      case 'space': 
        if (prev !== undefined && prev.hasOwnProperty('children')) {
          prev.children.push({type: 'after', pos: this.token.pos, text: this.token.text});
          return;
        } else {
          return; // {type: 'text',pos: this.token.pos, text: this.token.text};
        }
      case 'hr': return {type:'hr', pos: this.token.pos}; //TODO how do we display this with its before?
      case 'heading': return this.parseSection()
      case 'code': return this.parseCode();
      case 'table': return this.parseTable();
      case 'meta': return this.token;
      case 'blockquote_start': {
        var pos = this.token.pos,
            body = [{type: 'before', pos:pos, text: this.token.before}],
            item;
        while (this.next().type !== 'blockquote_end') {
          item = this.tok();
          if (item)
            body.push(item);
        }
        return {type: 'blockquote', pos: pos, children: body};
      }
      case 'list_start': {
        var body = [], item, pos = this.token.pos;
        while (this.next().type !== 'list_end') {
          item = this.tok();
          if (item)
            body.push(item);
        }
        return {type: (this.token.ordered ? 'ol' : 'ul'), children: body, pos: pos};
      }
      case 'list_item_start': {
        var pos = this.token.pos,
            body = [{type: 'before', pos:pos, text: this.token.before}],
            item;
        while (this.next().type !== 'list_item_end') {
          if (this.token.type === 'text') {
            var tx = this.parseText(this.token.pos);
            body = body.concat(tx);
          } else {
            item = this.tok();
            if (item)
              body.push(item);
          }
        }
        return {type: 'li', pos: pos, children: body};
      }
      case 'loose_item_start': {
        var body = [], item, pos = this.token.pos;
        while (this.next().type !== 'list_item_end') {
          item = this.tok();
          if (item)
            body.push(item);
        }
        return {type: 'li', pos: pos, children: body};
      }
      case 'html': {
        var html = !this.token.pre && !this.options.pedantic
          ? this.inline.output(this.token.text, this.token.pos)
          : this.token.text;
        return {type: 'html', pos: this.token.pos, raw: html};
      }
      case 'paragraph': 
        var after = this.token.after,
            l = this.token.text.length,
            pos = this.token.pos,
            p = {type: 'p', pos: pos, 
                children: this.inline.output(this.token.text, pos)};
        if (after.length > 0)
          p.children.push({type: 'after', pos: pos + l, text: after });
        return p;
      case 'text': return {type: 'p', pos: this.token.pos, children: this.parseText(this.token.pos)};
    }
};

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescape(html) {
  return html.replace(/&([#\w]+);/g, function(_, n) {
    n = n.toLowerCase();
    if (n === 'colon') return ':';
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1));
    }
    return '';
  });
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}


/**
 * clay
 */

function clay(src, opt, callback) {
  //TODO: replace with our parser
}

/**
 * Options
 */

clay.options =
clay.setOptions = function(opt) {
  merge(clay.defaults, opt);
  return clay;
};

clay.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  renderer: new Renderer,
  xhtml: false
};

/**
 * Expose
 */

clay.Parser = Parser;
clay.parser = Parser.parse;

clay.Renderer = Renderer;

clay.Lexer = Lexer;
clay.lexer = Lexer.lex;

clay.InlineLexer = InlineLexer;
clay.inlineLexer = InlineLexer.output;

clay.code = function() { return []; }; //replaced by parser module

clay.parse = clay;

if (typeof module !== 'undefined' && typeof exports === 'object') {
  module.exports = clay;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return clay; });
} else {
  this.clay = clay;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());