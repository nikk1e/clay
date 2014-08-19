# Clay/Cube

## Representations

Clay has three (3) representations for code. M-Expr, S-Expr, and JavaScript. M-Expr are the default format of code presented in a rendered document. S-Expr are used to represent the code for transformation and compilation. Javascript can be entered manually to define function and are generated by the compiler from the S-Exprs.

## Categories

Categories are defined using the empty slice `[]` notation in M-Expr. The reason we need the explicit `[]` slice is to separate categories from lists (e.g. to define a convolution kernel).

## Namespaces/Packages

User defined functions follow javascripts conventions and can have any required level of nesting. Clay models have one (and only one) level of nesting.  If a package name is not given then it defaults to the name Main. Packages can loose there ability to see a package by defining something with the same name. Otherwise, all packages imported are globally visible.

## Functions/Macros

Clay has 3 function types. User defined functions applied at evaluation time (e.g. Sum). Macros applied at compile time to replace an ast node with a transformed node. And, Assignment Macros, a special form of Macro, which replace X = MacroName(...) with the result of MacroName(X,...). The ast has a node id which is the source node for the code. This allows a result to be rendered editable.

## Tables

### Table Macro

	Table(expression, (rows), (cols), (pages), (descriptions))

Any unspecified dimensions of the expression automatically go into rows. All of the parameters are optional. Pages are all of the form `symb = value`. Descriptions must only vary over a single dimension.

### Table function

The table macro generates a call to the table function to actually do the rendering.

	table("quoted expression", expression[page filters][rows][cols], (col expr), (row expr), (page expr), (page expr)[page filters], "node id")

Each of `col expr`, `row expr`, and `page expr` is a nested list (e.g. `col expr[cols][elm of col][header + descriptions]`).

## Editor

```
Clay(X,...) {
	
}(X,...)
```

Clay requires a library to implement opening of models (json), saving etc are upto the editor


## Internals

(Restrict predicate expr) // (:predicate:) ? :expr: : undefined

(LetG symb value expr) // (:symb: == :value:) ? :expr: : undefined 
					   // with addition that symb is a category

(LetS symb value expr)  // function(:symb:) { return :expr:; }(:value:)

(Over expr symb(s)) // slice([symb],func([symb]) { return :expr:; })

(Indexed expr symb(s)) // (:expr:)[symb]

(Set symb expr) // from symb = expr or symb[...] = expr

(Category symb expr) //from symb[] = expr

(RemDims expr (List dims...)) // removes dims of dims from expr dims