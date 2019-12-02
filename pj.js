Array.prototype.orgToString = Array.prototype.toString
Array.prototype.toString = function () { return '[' + this.orgToString() + ']' }
const _ = undefined

function Var(value) {
    this.value = value
    this.lock = 0
    this.toString = () => (this.value === _) ? '_' : '' + this.value
    this.valueOf = () => this.value
}

function lock(obj, inc) {
    if (Array.isArray(obj)) obj.forEach(it => lock(it, inc))
    else if (obj instanceof Var) {
        if (Array.isArray(obj.value)) obj.value.forEach(it => lock(it, inc))
        else if ((obj.value !== _) && inc) obj.lock++
        else if ((obj.lock === 0) && (inc === _)) obj.value = _
        else if ((obj.lock > 0) && (inc === false)) { obj.lock--; if (!obj.lock) obj.value = _ }
    }
}

function merge(query, clause) {
    if (query instanceof Var) {
        if (query.value === _) query.value = clause.map(item => _)
        return merge(query.value, clause) // use query.value?
    }
    if (query.length !== clause.length) return null
    let i = 0
    while (i < query.length) {
        if (query[i] === _) query[i] = new Var()
        if ((clause[i] === _) || (query[i] === clause[i])) i++
        else if ((clause[i] instanceof Var) && (query[i] instanceof Var)) {
            if (query[i].value === _) query[i] = clause[i++]
            else if (clause[i].value === _) clause[i].value = query[i++].value
            else clause[i].value = query[i++].value
        }
        else if (clause[i] instanceof Var) clause[i].value = query[i++]
        else if (Array.isArray(clause[i]) && (query[i] instanceof Var || Array.isArray(query[i]))) i = merge(query[i], clause[i]) ? i + 1 : _
        else if (!Array.isArray(clause[i]) && query[i] instanceof Var && !query[i].lock) query[i].value = clause[i++]
        else if (query[i] instanceof Var && ((clause[i] === _) || (clause[i] === query[i].value))) i++
        else i = _
    }
    return (i !== _)
}

let flag = false

function Predicate(clauses = []) {
    function predicate(value) {
        let i = 0
        let iterator
        function next() {
            let found = false
            if (i === clauses.length) i = 0
            else while ((i < clauses.length) && !found) {
                if (typeof clauses[i] === 'function') {
                    if (iterator === _) iterator = clauses[i](value)[Symbol.iterator]()
                    let item = iterator.next()
                    if (item.done) iterator = _
                    else return item
                }
                else found = merge(value, clauses[i])
                if (!found) lock(value, _)
                i++
            }
            if (i === clauses.length && !found) i = 0
            return { done: (i === 0), value }
        }
        return { [Symbol.iterator]() { return { next } } }
    }
    predicate.set = (terms) => clauses.push(terms)
    return predicate
}

Predicate.conjunction = function* (...queries) {
    function* feeder([head, ...body]) {
        if (head) for (let res of head) {
            lock(res, true)
            yield* feeder(body)
            lock(res, false)
        } else yield
    }
    yield* feeder(queries)
}