

## Internals

(Restrict predicate expr) // (:predicate:) ? :expr: : undefined

(LetG symb value expr) // (:symb: == :value:) ? :expr: : undefined 
					   // with addition that symb is a category

(LetS symb value expr)  // function(:symb:) { return :expr:; }(:value:)

(Over expr symb(s)) // slice([symb],func([symb]) { return :expr:; })

(Indexed expr symb(s)) // (:expr:)[symb]

(Set symb expr) // from symb = expr or symb[...] = expr

(Category symb expr) //from symb[] = expr