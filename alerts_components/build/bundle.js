
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.47.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Header.svelte generated by Svelte v3.47.0 */

    const file$8 = "src\\Header.svelte";

    function create_fragment$b(ctx) {
    	let section2;
    	let section0;
    	let t1;
    	let section1;

    	const block = {
    		c: function create() {
    			section2 = element("section");
    			section0 = element("section");
    			section0.textContent = "Alerts";
    			t1 = space();
    			section1 = element("section");
    			attr_dev(section0, "class", "title svelte-kmsvgi");
    			add_location(section0, file$8, 8, 1, 81);
    			attr_dev(section1, "class", "controllers");
    			add_location(section1, file$8, 9, 1, 123);
    			attr_dev(section2, "class", "header svelte-kmsvgi");
    			add_location(section2, file$8, 7, 0, 54);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section2, anchor);
    			append_dev(section2, section0);
    			append_dev(section2, t1);
    			append_dev(section2, section1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* node_modules\@migueleraso\svelte_components\src\tabs\TabItem.svelte generated by Svelte v3.47.0 */

    const file$7 = "node_modules\\@migueleraso\\svelte_components\\src\\tabs\\TabItem.svelte";

    function create_fragment$a(ctx) {
    	let li;
    	let li_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	const block = {
    		c: function create() {
    			li = element("li");
    			if (default_slot) default_slot.c();
    			attr_dev(li, "class", li_class_value = "tabs_item " + /*activeClass*/ ctx[1] + " svelte-lwtg91");
    			attr_dev(li, "disabled", /*disabled*/ ctx[0]);
    			add_location(li, file$7, 21, 0, 283);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);

    			if (default_slot) {
    				default_slot.m(li, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(li, "click", /*activate*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*activeClass*/ 2 && li_class_value !== (li_class_value = "tabs_item " + /*activeClass*/ ctx[1] + " svelte-lwtg91")) {
    				attr_dev(li, "class", li_class_value);
    			}

    			if (!current || dirty & /*disabled*/ 1) {
    				attr_dev(li, "disabled", /*disabled*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let isActive;
    	let activeClass;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TabItem', slots, ['default']);
    	let { id = '' } = $$props;
    	let { disabled = false } = $$props;
    	let { activeItem = false } = $$props;

    	const activate = () => {
    		if (disabled) {
    			return;
    		}

    		$$invalidate(3, activeItem = id);
    	};

    	const writable_props = ['id', 'disabled', 'activeItem'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TabItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(4, id = $$props.id);
    		if ('disabled' in $$props) $$invalidate(0, disabled = $$props.disabled);
    		if ('activeItem' in $$props) $$invalidate(3, activeItem = $$props.activeItem);
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		id,
    		disabled,
    		activeItem,
    		activate,
    		isActive,
    		activeClass
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(4, id = $$props.id);
    		if ('disabled' in $$props) $$invalidate(0, disabled = $$props.disabled);
    		if ('activeItem' in $$props) $$invalidate(3, activeItem = $$props.activeItem);
    		if ('isActive' in $$props) $$invalidate(5, isActive = $$props.isActive);
    		if ('activeClass' in $$props) $$invalidate(1, activeClass = $$props.activeClass);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*activeItem, id*/ 24) {
    			$$invalidate(5, isActive = activeItem === id);
    		}

    		if ($$self.$$.dirty & /*isActive*/ 32) {
    			$$invalidate(1, activeClass = isActive ? 'active' : '');
    		}
    	};

    	return [disabled, activeClass, activate, activeItem, id, isActive, $$scope, slots];
    }

    class TabItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { id: 4, disabled: 0, activeItem: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TabItem",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get id() {
    		throw new Error("<TabItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<TabItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<TabItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<TabItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activeItem() {
    		throw new Error("<TabItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activeItem(value) {
    		throw new Error("<TabItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const setScrollLeft = (ulElement, add) => {

    	const SCROLL_INCREMENT = 0.95;
    	const INTERVAL = 100;
    	const SCROLL_TIME = 1000;

    	const multiplier = add ? 1 : -1;
    	const leftInterval = setInterval(() => {

    		ulElement.scrollLeft += ulElement.offsetWidth * (SCROLL_INCREMENT / INTERVAL) * multiplier;

    	}, SCROLL_TIME / INTERVAL);

    	setTimeout(() => {
    		clearInterval(leftInterval);
    	}, SCROLL_TIME);
    };

    /* node_modules\@migueleraso\svelte_components\src\tabs\Main.svelte generated by Svelte v3.47.0 */
    const file$6 = "node_modules\\@migueleraso\\svelte_components\\src\\tabs\\Main.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    // (56:3) <TabItem disabled={tab?.disabled} bind:activeItem id={tab?.id || tab?.text || tab}>
    function create_default_slot(ctx) {
    	let t0_value = (/*tab*/ ctx[13]?.text || /*tab*/ ctx[13] || /*index*/ ctx[15] + 1) + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tabs*/ 8 && t0_value !== (t0_value = (/*tab*/ ctx[13]?.text || /*tab*/ ctx[13] || /*index*/ ctx[15] + 1) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(56:3) <TabItem disabled={tab?.disabled} bind:activeItem id={tab?.id || tab?.text || tab}>",
    		ctx
    	});

    	return block;
    }

    // (55:2) {#each tabs as tab, index}
    function create_each_block(ctx) {
    	let tabitem;
    	let updating_activeItem;
    	let current;

    	function tabitem_activeItem_binding(value) {
    		/*tabitem_activeItem_binding*/ ctx[9](value);
    	}

    	let tabitem_props = {
    		disabled: /*tab*/ ctx[13]?.disabled,
    		id: /*tab*/ ctx[13]?.id || /*tab*/ ctx[13]?.text || /*tab*/ ctx[13],
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	if (/*activeItem*/ ctx[0] !== void 0) {
    		tabitem_props.activeItem = /*activeItem*/ ctx[0];
    	}

    	tabitem = new TabItem({ props: tabitem_props, $$inline: true });
    	binding_callbacks.push(() => bind(tabitem, 'activeItem', tabitem_activeItem_binding));

    	const block = {
    		c: function create() {
    			create_component(tabitem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tabitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tabitem_changes = {};
    			if (dirty & /*tabs*/ 8) tabitem_changes.disabled = /*tab*/ ctx[13]?.disabled;
    			if (dirty & /*tabs*/ 8) tabitem_changes.id = /*tab*/ ctx[13]?.id || /*tab*/ ctx[13]?.text || /*tab*/ ctx[13];

    			if (dirty & /*$$scope, tabs*/ 65544) {
    				tabitem_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_activeItem && dirty & /*activeItem*/ 1) {
    				updating_activeItem = true;
    				tabitem_changes.activeItem = /*activeItem*/ ctx[0];
    				add_flush_callback(() => updating_activeItem = false);
    			}

    			tabitem.$set(tabitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tabitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(55:2) {#each tabs as tab, index}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div1;
    	let span;
    	let t1;
    	let ul;
    	let t2;
    	let div0;
    	let div1_class_value;
    	let current;
    	let each_value = /*tabs*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span = element("span");
    			span.textContent = `${'<'}`;
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			div0 = element("div");
    			div0.textContent = `${'>'}`;
    			attr_dev(span, "class", "arrow left svelte-2aiga7");
    			add_location(span, file$6, 48, 1, 994);
    			attr_dev(ul, "class", "svelte-2aiga7");
    			add_location(ul, file$6, 52, 1, 1065);
    			attr_dev(div0, "class", "arrow right svelte-2aiga7");
    			add_location(div0, file$6, 62, 1, 1292);
    			attr_dev(div1, "class", div1_class_value = "tabs_container " + /*className*/ ctx[1] + " svelte-2aiga7");
    			attr_dev(div1, "style", /*style*/ ctx[2]);
    			add_location(div1, file$6, 46, 0, 940);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span);
    			/*span_binding*/ ctx[8](span);
    			append_dev(div1, t1);
    			append_dev(div1, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			/*ul_binding*/ ctx[10](ul);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			/*div0_binding*/ ctx[11](div0);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*tabs, activeItem*/ 9) {
    				each_value = /*tabs*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*className*/ 2 && div1_class_value !== (div1_class_value = "tabs_container " + /*className*/ ctx[1] + " svelte-2aiga7")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (!current || dirty & /*style*/ 4) {
    				attr_dev(div1, "style", /*style*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*span_binding*/ ctx[8](null);
    			destroy_each(each_blocks, detaching);
    			/*ul_binding*/ ctx[10](null);
    			/*div0_binding*/ ctx[11](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Main', slots, []);
    	let { activeItem = null } = $$props;
    	let { className = '' } = $$props;
    	let { style = '' } = $$props;
    	let { tabs = [] } = $$props;
    	let ulElement = null;
    	let arrowLeft = null;
    	let arrowRight = null;
    	let allowArrows = false;

    	const checkResize = () => {
    		$$invalidate(7, allowArrows = ulElement
    		? ulElement.scrollWidth > ulElement.offsetWidth
    		: false);
    	};

    	onMount(() => {
    		checkResize();
    		window.addEventListener("resize", () => checkResize());

    		$$invalidate(
    			5,
    			arrowLeft.onclick = () => {
    				setScrollLeft(ulElement, false);
    			},
    			arrowLeft
    		);

    		$$invalidate(
    			6,
    			arrowRight.onclick = () => {
    				setScrollLeft(ulElement, true);
    			},
    			arrowRight
    		);
    	});

    	const writable_props = ['activeItem', 'className', 'style', 'tabs'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Main> was created with unknown prop '${key}'`);
    	});

    	function span_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			arrowLeft = $$value;
    			(($$invalidate(5, arrowLeft), $$invalidate(7, allowArrows)), $$invalidate(4, ulElement));
    		});
    	}

    	function tabitem_activeItem_binding(value) {
    		activeItem = value;
    		$$invalidate(0, activeItem);
    	}

    	function ul_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			ulElement = $$value;
    			$$invalidate(4, ulElement);
    		});
    	}

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			arrowRight = $$value;
    			(($$invalidate(6, arrowRight), $$invalidate(7, allowArrows)), $$invalidate(4, ulElement));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('activeItem' in $$props) $$invalidate(0, activeItem = $$props.activeItem);
    		if ('className' in $$props) $$invalidate(1, className = $$props.className);
    		if ('style' in $$props) $$invalidate(2, style = $$props.style);
    		if ('tabs' in $$props) $$invalidate(3, tabs = $$props.tabs);
    	};

    	$$self.$capture_state = () => ({
    		TabItem,
    		setScrollLeft,
    		onMount,
    		activeItem,
    		className,
    		style,
    		tabs,
    		ulElement,
    		arrowLeft,
    		arrowRight,
    		allowArrows,
    		checkResize
    	});

    	$$self.$inject_state = $$props => {
    		if ('activeItem' in $$props) $$invalidate(0, activeItem = $$props.activeItem);
    		if ('className' in $$props) $$invalidate(1, className = $$props.className);
    		if ('style' in $$props) $$invalidate(2, style = $$props.style);
    		if ('tabs' in $$props) $$invalidate(3, tabs = $$props.tabs);
    		if ('ulElement' in $$props) $$invalidate(4, ulElement = $$props.ulElement);
    		if ('arrowLeft' in $$props) $$invalidate(5, arrowLeft = $$props.arrowLeft);
    		if ('arrowRight' in $$props) $$invalidate(6, arrowRight = $$props.arrowRight);
    		if ('allowArrows' in $$props) $$invalidate(7, allowArrows = $$props.allowArrows);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*allowArrows, ulElement*/ 144) {
    			if (!allowArrows && ulElement) {
    				$$invalidate(5, arrowLeft.style.display = 'none', arrowLeft);
    				$$invalidate(6, arrowRight.style.display = 'none', arrowRight);
    			} else if (ulElement) {
    				$$invalidate(5, arrowLeft.style.display = '', arrowLeft);
    				$$invalidate(6, arrowRight.style.display = '', arrowRight);
    			}
    		}
    	};

    	return [
    		activeItem,
    		className,
    		style,
    		tabs,
    		ulElement,
    		arrowLeft,
    		arrowRight,
    		allowArrows,
    		span_binding,
    		tabitem_activeItem_binding,
    		ul_binding,
    		div0_binding
    	];
    }

    class Main$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			activeItem: 0,
    			className: 1,
    			style: 2,
    			tabs: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Main",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get activeItem() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activeItem(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get className() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tabs() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tabs(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const typesOfModal = {

    	medium: {
    		'--margin-top' : '20px',
    		'--width' : 'min(1000px, 100%)',
    	},

    	full_screen: {
    		'--margin-top' : '0px',
    		'--width' : '100%',
    		'height': '100%',
    	},

    	large: {
    		'--width' : '95%',
    		'--margin-top' : '20px',
    		'max-width' : '1400px',
    	},

    	medium_small: {
    		'--margin-top' : '40px',
    		'--width' : 'min(600px, 100%)',
    	},

    	small: {
    		'--margin-top' : '40px',
    		'--width' : 'min(400px, 100%)',
    	}
    };

    typesOfModal.default = typesOfModal.medium;

    const getTypesOfModal = () => {
    	return typesOfModal
    };






















    const setHTMlOverFlow = (visible) => {

    	const html = document.querySelector('html');

    	if (visible) {
    		html.style.overflow = 'hidden';
    	}
    	else {
    		html.style.overflow = '';
    	}
    };

    const getModalType = (modalType) =>  {
    	const _typesOfModal = getTypesOfModal();
    	return _typesOfModal[modalType] || _typesOfModal['default']
    };

    const getStylesByModalType = (modalType) =>  {

    	const _modalType = getModalType(modalType);

    	let result = '';

    	for (const key in _modalType) {
    		result += `${key}: ${_modalType[key]};`;
    	}

    	return result
    };


    const getAlign = (align) => {

    	if (align === 'right' || align === 'left') {
    		return align
    	}

    	return 'center'
    };




    const getVerticalAlign = (align) => {

    	if (align === 'middle' || align === 'bottom') {
    		return align
    	}

    	return 'top'
    };

    /* node_modules\@migueleraso\svelte_components\src\modal\Main.svelte generated by Svelte v3.47.0 */
    const file$5 = "node_modules\\@migueleraso\\svelte_components\\src\\modal\\Main.svelte";

    function create_fragment$8(ctx) {
    	let div2;
    	let div0;
    	let t;
    	let div1;
    	let div1_class_value;
    	let div2_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[17].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "sc_modal--surface svelte-ebcf2s");
    			add_location(div0, file$5, 55, 1, 1290);
    			attr_dev(div1, "class", div1_class_value = "sc_modal--container " + (/*complete*/ ctx[0] ? 'complete' : '') + " svelte-ebcf2s");
    			attr_dev(div1, "style", /*_style*/ ctx[6]);
    			add_location(div1, file$5, 57, 1, 1384);
    			attr_dev(div2, "class", div2_class_value = "sc_modal " + /*showClass*/ ctx[3] + " " + /*alignClass*/ ctx[5] + " " + /*verticalAlignClass*/ ctx[4] + " svelte-ebcf2s");
    			add_location(div2, file$5, 53, 0, 1191);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			/*div0_binding*/ ctx[18](div0);
    			append_dev(div2, t);
    			append_dev(div2, div1);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			/*div2_binding*/ ctx[19](div2);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*closeModal*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 65536)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[16],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[16])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*complete*/ 1 && div1_class_value !== (div1_class_value = "sc_modal--container " + (/*complete*/ ctx[0] ? 'complete' : '') + " svelte-ebcf2s")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (!current || dirty & /*_style*/ 64) {
    				attr_dev(div1, "style", /*_style*/ ctx[6]);
    			}

    			if (!current || dirty & /*showClass, alignClass, verticalAlignClass*/ 56 && div2_class_value !== (div2_class_value = "sc_modal " + /*showClass*/ ctx[3] + " " + /*alignClass*/ ctx[5] + " " + /*verticalAlignClass*/ ctx[4] + " svelte-ebcf2s")) {
    				attr_dev(div2, "class", div2_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			/*div0_binding*/ ctx[18](null);
    			if (default_slot) default_slot.d(detaching);
    			/*div2_binding*/ ctx[19](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let _style;
    	let alignClass;
    	let verticalAlignClass;
    	let showClass;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Main', slots, ['default']);
    	let { show = false } = $$props;
    	let { align = null } = $$props;
    	let { onShow = null } = $$props;
    	let { complete = false } = $$props;
    	let { verticalAlign = null } = $$props;
    	let { verticalMargin = null } = $$props;
    	let { modalType = 'default' } = $$props;
    	let { allowCloseOnSurfaceElement = true } = $$props;
    	let { style = '' } = $$props;
    	let modalElement = null;
    	let surfaceElement = null;

    	const onChangeState = () => {
    		setHTMlOverFlow(show);

    		if (show && typeof onShow === 'function') {
    			onShow();
    		}
    	};

    	const closeModal = e => {
    		if (allowCloseOnSurfaceElement) {
    			$$invalidate(8, show = false);
    		}
    	};

    	onMount(() => {
    		$$invalidate(
    			1,
    			modalElement.onscroll = () => {
    				$$invalidate(2, surfaceElement.style.top = modalElement.scrollTop + 'px', surfaceElement);
    			},
    			modalElement
    		);
    	});

    	const writable_props = [
    		'show',
    		'align',
    		'onShow',
    		'complete',
    		'verticalAlign',
    		'verticalMargin',
    		'modalType',
    		'allowCloseOnSurfaceElement',
    		'style'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Main> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			surfaceElement = $$value;
    			$$invalidate(2, surfaceElement);
    		});
    	}

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			modalElement = $$value;
    			$$invalidate(1, modalElement);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('show' in $$props) $$invalidate(8, show = $$props.show);
    		if ('align' in $$props) $$invalidate(9, align = $$props.align);
    		if ('onShow' in $$props) $$invalidate(10, onShow = $$props.onShow);
    		if ('complete' in $$props) $$invalidate(0, complete = $$props.complete);
    		if ('verticalAlign' in $$props) $$invalidate(11, verticalAlign = $$props.verticalAlign);
    		if ('verticalMargin' in $$props) $$invalidate(12, verticalMargin = $$props.verticalMargin);
    		if ('modalType' in $$props) $$invalidate(13, modalType = $$props.modalType);
    		if ('allowCloseOnSurfaceElement' in $$props) $$invalidate(14, allowCloseOnSurfaceElement = $$props.allowCloseOnSurfaceElement);
    		if ('style' in $$props) $$invalidate(15, style = $$props.style);
    		if ('$$scope' in $$props) $$invalidate(16, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		setHTMlOverFlow,
    		getAlign,
    		getStylesByModalType,
    		getVerticalAlign,
    		onMount,
    		show,
    		align,
    		onShow,
    		complete,
    		verticalAlign,
    		verticalMargin,
    		modalType,
    		allowCloseOnSurfaceElement,
    		style,
    		modalElement,
    		surfaceElement,
    		onChangeState,
    		closeModal,
    		showClass,
    		verticalAlignClass,
    		alignClass,
    		_style
    	});

    	$$self.$inject_state = $$props => {
    		if ('show' in $$props) $$invalidate(8, show = $$props.show);
    		if ('align' in $$props) $$invalidate(9, align = $$props.align);
    		if ('onShow' in $$props) $$invalidate(10, onShow = $$props.onShow);
    		if ('complete' in $$props) $$invalidate(0, complete = $$props.complete);
    		if ('verticalAlign' in $$props) $$invalidate(11, verticalAlign = $$props.verticalAlign);
    		if ('verticalMargin' in $$props) $$invalidate(12, verticalMargin = $$props.verticalMargin);
    		if ('modalType' in $$props) $$invalidate(13, modalType = $$props.modalType);
    		if ('allowCloseOnSurfaceElement' in $$props) $$invalidate(14, allowCloseOnSurfaceElement = $$props.allowCloseOnSurfaceElement);
    		if ('style' in $$props) $$invalidate(15, style = $$props.style);
    		if ('modalElement' in $$props) $$invalidate(1, modalElement = $$props.modalElement);
    		if ('surfaceElement' in $$props) $$invalidate(2, surfaceElement = $$props.surfaceElement);
    		if ('showClass' in $$props) $$invalidate(3, showClass = $$props.showClass);
    		if ('verticalAlignClass' in $$props) $$invalidate(4, verticalAlignClass = $$props.verticalAlignClass);
    		if ('alignClass' in $$props) $$invalidate(5, alignClass = $$props.alignClass);
    		if ('_style' in $$props) $$invalidate(6, _style = $$props._style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*show*/ 256) {
    			show + onChangeState();
    		}

    		if ($$self.$$.dirty & /*modalType, style, verticalMargin*/ 45056) {
    			$$invalidate(6, _style = `
		${getStylesByModalType(modalType)}
		${style}
		${verticalMargin && modalType !== 'full_screen'
			? `--margin-top: ${verticalMargin};`
			: ''}
	`);
    		}

    		if ($$self.$$.dirty & /*align*/ 512) {
    			$$invalidate(5, alignClass = getAlign(align));
    		}

    		if ($$self.$$.dirty & /*verticalAlign*/ 2048) {
    			$$invalidate(4, verticalAlignClass = getVerticalAlign(verticalAlign));
    		}

    		if ($$self.$$.dirty & /*show*/ 256) {
    			$$invalidate(3, showClass = show ? 'show' : 'hide');
    		}
    	};

    	return [
    		complete,
    		modalElement,
    		surfaceElement,
    		showClass,
    		verticalAlignClass,
    		alignClass,
    		_style,
    		closeModal,
    		show,
    		align,
    		onShow,
    		verticalAlign,
    		verticalMargin,
    		modalType,
    		allowCloseOnSurfaceElement,
    		style,
    		$$scope,
    		slots,
    		div0_binding,
    		div2_binding
    	];
    }

    class Main extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			show: 8,
    			align: 9,
    			onShow: 10,
    			complete: 0,
    			verticalAlign: 11,
    			verticalMargin: 12,
    			modalType: 13,
    			allowCloseOnSurfaceElement: 14,
    			style: 15
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Main",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get show() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set show(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get align() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set align(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onShow() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onShow(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get complete() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set complete(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get verticalAlign() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set verticalAlign(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get verticalMargin() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set verticalMargin(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get modalType() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set modalType(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get allowCloseOnSurfaceElement() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set allowCloseOnSurfaceElement(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\@migueleraso\svelte_components\src\modal\Body.svelte generated by Svelte v3.47.0 */

    const file$4 = "node_modules\\@migueleraso\\svelte_components\\src\\modal\\Body.svelte";

    function create_fragment$7(ctx) {
    	let section;
    	let section_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			section = element("section");
    			if (default_slot) default_slot.c();
    			attr_dev(section, "class", section_class_value = "sc_modal--body " + /*className*/ ctx[0] + " svelte-uxjysz");
    			attr_dev(section, "style", /*style*/ ctx[1]);
    			add_location(section, file$4, 8, 0, 81);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);

    			if (default_slot) {
    				default_slot.m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*className*/ 1 && section_class_value !== (section_class_value = "sc_modal--body " + /*className*/ ctx[0] + " svelte-uxjysz")) {
    				attr_dev(section, "class", section_class_value);
    			}

    			if (!current || dirty & /*style*/ 2) {
    				attr_dev(section, "style", /*style*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Body', slots, ['default']);
    	let { className = '' } = $$props;
    	let { style = '' } = $$props;
    	const writable_props = ['className', 'style'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Body> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('className' in $$props) $$invalidate(0, className = $$props.className);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ className, style });

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate(0, className = $$props.className);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [className, style, $$scope, slots];
    }

    class Body extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { className: 0, style: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Body",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get className() {
    		throw new Error("<Body>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<Body>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Body>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Body>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    Main.Body = Body;

    /* src\Pages.svelte generated by Svelte v3.47.0 */

    function create_fragment$6(ctx) {
    	let tabscontainer;
    	let updating_activeItem;
    	let current;

    	function tabscontainer_activeItem_binding(value) {
    		/*tabscontainer_activeItem_binding*/ ctx[2](value);
    	}

    	let tabscontainer_props = { tabs: /*tabs*/ ctx[1] };

    	if (/*page*/ ctx[0] !== void 0) {
    		tabscontainer_props.activeItem = /*page*/ ctx[0];
    	}

    	tabscontainer = new Main$1({
    			props: tabscontainer_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(tabscontainer, 'activeItem', tabscontainer_activeItem_binding));

    	const block = {
    		c: function create() {
    			create_component(tabscontainer.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tabscontainer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const tabscontainer_changes = {};
    			if (dirty & /*tabs*/ 2) tabscontainer_changes.tabs = /*tabs*/ ctx[1];

    			if (!updating_activeItem && dirty & /*page*/ 1) {
    				updating_activeItem = true;
    				tabscontainer_changes.activeItem = /*page*/ ctx[0];
    				add_flush_callback(() => updating_activeItem = false);
    			}

    			tabscontainer.$set(tabscontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabscontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabscontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tabscontainer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Pages', slots, []);
    	let { page = '' } = $$props;
    	let { tabs = [] } = $$props;
    	const writable_props = ['page', 'tabs'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Pages> was created with unknown prop '${key}'`);
    	});

    	function tabscontainer_activeItem_binding(value) {
    		page = value;
    		$$invalidate(0, page);
    	}

    	$$self.$$set = $$props => {
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    		if ('tabs' in $$props) $$invalidate(1, tabs = $$props.tabs);
    	};

    	$$self.$capture_state = () => ({ TabsContainer: Main$1, page, tabs });

    	$$self.$inject_state = $$props => {
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    		if ('tabs' in $$props) $$invalidate(1, tabs = $$props.tabs);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [page, tabs, tabscontainer_activeItem_binding];
    }

    class Pages extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { page: 0, tabs: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pages",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get page() {
    		throw new Error("<Pages>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set page(value) {
    		throw new Error("<Pages>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tabs() {
    		throw new Error("<Pages>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tabs(value) {
    		throw new Error("<Pages>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\GetStarted.svelte generated by Svelte v3.47.0 */

    const file$3 = "src\\pages\\GetStarted.svelte";

    function create_fragment$5(ctx) {
    	let section;
    	let i;
    	let t1;
    	let br;
    	let t2;

    	const block = {
    		c: function create() {
    			section = element("section");
    			i = element("i");
    			i.textContent = "Install:";
    			t1 = space();
    			br = element("br");
    			t2 = text("\r\n\tnpm i @migueleraso/alerts_components");
    			add_location(i, file$3, 4, 1, 34);
    			add_location(br, file$3, 5, 1, 52);
    			attr_dev(section, "class", "content svelte-lbz0qu");
    			add_location(section, file$3, 2, 0, 4);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, i);
    			append_dev(section, t1);
    			append_dev(section, br);
    			append_dev(section, t2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GetStarted', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<GetStarted> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class GetStarted extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GetStarted",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    function t(){}function e(t){return t()}function n(){return Object.create(null)}function o(t){t.forEach(e);}function s(t){return "function"==typeof t}function l(t,e){return t!=t?e==e:t!==e||t&&"object"==typeof t||"function"==typeof t}function a(t,e){t.appendChild(e);}function i(t,e,n){const o=function(t){if(!t)return document;const e=t.getRootNode?t.getRootNode():t.ownerDocument;if(e&&e.host)return e;return t.ownerDocument}(t);if(!o.getElementById(e)){const t=u("style");t.id=e,t.textContent=n,function(t,e){a(t.head||t,e);}(o,t);}}function c(t,e,n){t.insertBefore(e,n||null);}function r(t){t.parentNode.removeChild(t);}function u(t){return document.createElement(t)}function p(t){return document.createTextNode(t)}function f(){return p(" ")}function d(){return p("")}function _(t,e,n,o){return t.addEventListener(e,n,o),()=>t.removeEventListener(e,n,o)}function m(t,e,n){null==n?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n);}function g(t){return ""===t?null:+t}function h(t,e){e=""+e,t.wholeText!==e&&(t.data=e);}function x(t,e){t.value=null==e?"":e;}let v;function y(t){v=t;}const b=[],$=[],k=[],w=[],q=Promise.resolve();let j=!1;function C(t){k.push(t);}const N=new Set;let B=0;function E(){const t=v;do{for(;B<b.length;){const t=b[B];B++,y(t),T(t.$$);}for(y(null),b.length=0,B=0;$.length;)$.pop()();for(let t=0;t<k.length;t+=1){const e=k[t];N.has(e)||(N.add(e),e());}k.length=0;}while(b.length);for(;w.length;)w.pop()();j=!1,N.clear(),y(t);}function T(t){if(null!==t.fragment){t.update(),o(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(C);}}const A=new Set;let L;function D(){L={r:0,c:[],p:L};}function z(){L.r||o(L.c),L=L.p;}function U(t,e){t&&t.i&&(A.delete(t),t.i(e));}function M(t,e,n,o){if(t&&t.o){if(A.has(t))return;A.add(t),L.c.push((()=>{A.delete(t),o&&(n&&t.d(1),o());})),t.o(e);}}function O(t,n,l,a){const{fragment:i,on_mount:c,on_destroy:r,after_update:u}=t.$$;i&&i.m(n,l),a||C((()=>{const n=c.map(e).filter(s);r?r.push(...n):o(n),t.$$.on_mount=[];})),u.forEach(C);}function P(t,e){const n=t.$$;null!==n.fragment&&(o(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[]);}function R(t,e){-1===t.$$.dirty[0]&&(b.push(t),j||(j=!0,q.then(E)),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31;}function S(e,s,l,a,i,c,u,p=[-1]){const f=v;y(e);const d=e.$$={fragment:null,ctx:null,props:c,update:t,not_equal:i,bound:n(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(s.context||(f?f.$$.context:[])),callbacks:n(),dirty:p,skip_bound:!1,root:s.target||f.$$.root};u&&u(d.root);let _=!1;if(d.ctx=l?l(e,s.props||{},((t,n,...o)=>{const s=o.length?o[0]:n;return d.ctx&&i(d.ctx[t],d.ctx[t]=s)&&(!d.skip_bound&&d.bound[t]&&d.bound[t](s),_&&R(e,t)),n})):[],d.update(),_=!0,o(d.before_update),d.fragment=!!a&&a(d.ctx),s.target){if(s.hydrate){const t=function(t){return Array.from(t.childNodes)}(s.target);d.fragment&&d.fragment.l(t),t.forEach(r);}else d.fragment&&d.fragment.c();s.intro&&U(e.$$.fragment),O(e,s.target,s.anchor,s.customElement),E();}y(f);}class Y{$destroy(){P(this,1),this.$destroy=t;}$on(t,e){const n=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return n.push(e),()=>{const t=n.indexOf(e);-1!==t&&n.splice(t,1);}}$set(t){var e;this.$$set&&(e=t,0!==Object.keys(e).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1);}}const H={"bottom-left":"ec_toast_bottom_left","bottom-right":"ec_toast_bottom_right","top-left":"ec_toast_top_left","top-right":"ec_toast_top_right"},I={warning:"ec_toast_warning",success:"ec_toast_success",danger:"ec_toast_danger",light:"ec_toast_light",info:"ec_toast_info",dark:"ec_toast_dark"},F=({element:t,onDismiss:e,resultArgs:n})=>{if(!t.classList.contains("ec_toast_removing"))try{t.classList.add("ec_toast_removing"),"function"==typeof e&&e(n),setTimeout((()=>{t.parentNode.removeChild(t);}),2e3);}catch(t){}};function G(t){i(t,"svelte-hglxiy",".ec_toast_contaner.svelte-hglxiy,.ec_toast_contaner.svelte-hglxiy *{box-sizing:border-box}.ec_toast_contaner.svelte-hglxiy{flex-direction:column;position:fixed;display:flex;height:auto;margin:20px;grid-gap:20px;z-index:99999}.ec_bottom_left_toast.svelte-hglxiy{left:0;bottom:0}.ec_top_left_toast.svelte-hglxiy{top:0;left:0}.ec_bottom_right_toast.svelte-hglxiy{right:0;bottom:0}.ec_top_right_toast.svelte-hglxiy{top:0;right:0}.ec_toast_contaner.svelte-hglxiy .ec_toast{position:relative;color:#000;width:250px;padding:15px 20px;border-radius:5px;box-shadow:0 0 10px rgba(0, 0, 0, 0.1)}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_warning{background-color:#ffec00}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_success{background-color:#a5af0a}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_danger{background-color:#ef082b}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_info{background-color:#0882ef}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_dark{background-color:#0b0b0c;color:#ffffff}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_light{background-color:#f0f0f0}.ec_toast_contaner.ec_bottom_left_toast.svelte-hglxiy .ec_toast{animation:svelte-hglxiy-ec_toast_animation_bottom_left 1.5s}.ec_toast_contaner.ec_top_left_toast.svelte-hglxiy .ec_toast{animation:svelte-hglxiy-ec_toast_animation_top_left 1.5s}.ec_toast_contaner.ec_bottom_right_toast.svelte-hglxiy .ec_toast{animation:svelte-hglxiy-ec_toast_animation_bottom_right 1.5s}.ec_toast_contaner.ec_top_right_toast.svelte-hglxiy .ec_toast{animation:svelte-hglxiy-ec_toast_animation_top_right 1.5s}@keyframes svelte-hglxiy-ec_toast_animation_bottom_left{0%{margin-bottom:-20px;margin-left:-20px}100%{margin:0px}}@keyframes svelte-hglxiy-ec_toast_animation_top_left{0%{margin-top:-20px;margin-left:-20px}100%{margin:0px}}@keyframes svelte-hglxiy-ec_toast_animation_bottom_right{0%{margin-bottom:-20px;margin-right:-20px}100%{margin:0px}}@keyframes svelte-hglxiy-ec_toast_animation_top_right{0%{margin-top:-20px;margin-right:-20px}100%{margin:0px}}.ec_toast_contaner.svelte-hglxiy .ec_toast.ec_toast_removing{animation:svelte-hglxiy-ec_toast_animation_removing 2s}@keyframes svelte-hglxiy-ec_toast_animation_removing{0%{opacity:1}100%{opacity:0}}");}function J(e){let n,o,s,l,a,i,p;return {c(){n=u("div"),o=f(),s=u("div"),l=f(),a=u("div"),i=f(),p=u("div"),m(n,"class","ec_toast_contaner ec_bottom_left_toast svelte-hglxiy"),m(s,"class","ec_toast_contaner ec_top_left_toast svelte-hglxiy"),m(a,"class","ec_toast_contaner ec_bottom_right_toast svelte-hglxiy"),m(p,"class","ec_toast_contaner ec_top_right_toast svelte-hglxiy");},m(t,r){c(t,n,r),e[2](n),c(t,o,r),c(t,s,r),e[3](s),c(t,l,r),c(t,a,r),e[4](a),c(t,i,r),c(t,p,r),e[5](p);},p:t,i:t,o:t,d(t){t&&r(n),e[2](null),t&&r(o),t&&r(s),e[3](null),t&&r(l),t&&r(a),e[4](null),t&&r(i),t&&r(p),e[5](null);}}}function K(t,e,n){let{setUseToast:o=(()=>{})}=e;const s={};return o((t=>{t=(({args:t,elements:e})=>{const n=!(!1===(t=t||{}).dismissable),o=t.duration||5e3,s=t.type||"success",l=t.position||"bottom-left",a=e[l]||e["bottom-left"],i=I[s]||I.success,c=H[l]||H["bottom-left"],r=t.defaultMessage||"";return {target:a,position:l,duration:o,typeClass:i,onDismiss:t.onDismiss||null,dismissable:n,positionClass:c,defaultMessage:r}})({args:t,elements:s});const{target:e,duration:n,position:o,typeClass:l,dismissable:a,positionClass:i,defaultMessage:c,onDismiss:r}=t;return s=>{const u=(({message:t,typeClass:e,positionClass:n})=>{const o=document.createElement("div");return o.classList.add("ec_toast"),o.classList.add(e),o.classList.add(n),o.innerHTML=t,o})({message:s=s||c||"",typeClass:l,positionClass:i}),p={...t,message:s,dismissedByUser:!1};a&&(u.onclick=()=>{p.dismissedByUser=!0,F({element:u,resultArgs:p,onDismiss:r});}),(({position:t,target:e,element:n})=>{t.indexOf("top")>-1?e.prepend(n):e.appendChild(n);})({position:o,target:e,element:u}),setTimeout((()=>{F({element:u,resultArgs:p,onDismiss:r});}),n);}})),t.$$set=t=>{"setUseToast"in t&&n(1,o=t.setUseToast);},[s,o,function(t){$[t?"unshift":"push"]((()=>{s["bottom-left"]=t,n(0,s);}));},function(t){$[t?"unshift":"push"]((()=>{s["top-left"]=t,n(0,s);}));},function(t){$[t?"unshift":"push"]((()=>{s["bottom-right"]=t,n(0,s);}));},function(t){$[t?"unshift":"push"]((()=>{s["top-right"]=t,n(0,s);}));}]}let Q=()=>{};new class extends Y{constructor(t){super(),S(this,t,K,J,l,{setUseToast:1},G);}}({target:document.body,props:{setUseToast:t=>Q=t}});function V(t){i(t,"svelte-1fxyqdk","label.svelte-1fxyqdk{display:inherit;margin:15px 10px 0px}.ec_alert_input.svelte-1fxyqdk{width:100%;border:0px;height:35px;padding:10px;margin-top:10px;border-radius:5px;box-shadow:1px 2px 10px rgb(0 0 0 / 20%)}textarea.svelte-1fxyqdk{resize:vertical;min-height:55px}");}function W(t){let e,n,o,s=t[0].label+"";return {c(){e=u("label"),n=p(s),m(e,"for",o=t[0].name),m(e,"class","svelte-1fxyqdk");},m(t,o){c(t,e,o),a(e,n);},p(t,l){1&l&&s!==(s=t[0].label+"")&&h(n,s),1&l&&o!==(o=t[0].name)&&m(e,"for",o);},d(t){t&&r(e);}}}function X(t){let e,n,o,s;return {c(){e=u("input"),m(e,"type","text"),m(e,"class","ec_alert_input svelte-1fxyqdk"),m(e,"placeholder",n=t[0].placeholder);},m(n,l){c(n,e,l),x(e,t[0].value),o||(s=_(e,"input",t[1]),o=!0);},p(t,o){1&o&&n!==(n=t[0].placeholder)&&m(e,"placeholder",n),1&o&&e.value!==t[0].value&&x(e,t[0].value);},d(t){t&&r(e),o=!1,s();}}}function Z(t){let e,n,o,s;return {c(){e=u("input"),m(e,"type","password"),m(e,"class","ec_alert_input svelte-1fxyqdk"),m(e,"placeholder",n=t[0].placeholder);},m(n,l){c(n,e,l),x(e,t[0].value),o||(s=_(e,"input",t[2]),o=!0);},p(t,o){1&o&&n!==(n=t[0].placeholder)&&m(e,"placeholder",n),1&o&&e.value!==t[0].value&&x(e,t[0].value);},d(t){t&&r(e),o=!1,s();}}}function tt(t){let e,n,o,s;return {c(){e=u("input"),m(e,"type","email"),m(e,"class","ec_alert_input svelte-1fxyqdk"),m(e,"placeholder",n=t[0].placeholder);},m(n,l){c(n,e,l),x(e,t[0].value),o||(s=_(e,"input",t[3]),o=!0);},p(t,o){1&o&&n!==(n=t[0].placeholder)&&m(e,"placeholder",n),1&o&&e.value!==t[0].value&&x(e,t[0].value);},d(t){t&&r(e),o=!1,s();}}}function et(t){let e,n,o,s;return {c(){e=u("input"),m(e,"type","number"),m(e,"class","ec_alert_input svelte-1fxyqdk"),m(e,"placeholder",n=t[0].placeholder);},m(n,l){c(n,e,l),x(e,t[0].value),o||(s=_(e,"input",t[4]),o=!0);},p(t,o){1&o&&n!==(n=t[0].placeholder)&&m(e,"placeholder",n),1&o&&g(e.value)!==t[0].value&&x(e,t[0].value);},d(t){t&&r(e),o=!1,s();}}}function nt(t){let e,n,o,s;return {c(){e=u("textarea"),m(e,"class","ec_alert_input svelte-1fxyqdk"),m(e,"placeholder",n=t[0].placeholder);},m(n,l){c(n,e,l),x(e,t[0].value),o||(s=_(e,"input",t[5]),o=!0);},p(t,o){1&o&&n!==(n=t[0].placeholder)&&m(e,"placeholder",n),1&o&&x(e,t[0].value);},d(t){t&&r(e),o=!1,s();}}}function ot(e){let n,o,s,l,a,i,u=e[0].label&&W(e),p="text"===e[0].type&&X(e),_="password"===e[0].type&&Z(e),m="email"===e[0].type&&tt(e),g="number"===e[0].type&&et(e),h="textarea"===e[0].type&&nt(e);return {c(){u&&u.c(),n=f(),p&&p.c(),o=f(),_&&_.c(),s=f(),m&&m.c(),l=f(),g&&g.c(),a=f(),h&&h.c(),i=d();},m(t,e){u&&u.m(t,e),c(t,n,e),p&&p.m(t,e),c(t,o,e),_&&_.m(t,e),c(t,s,e),m&&m.m(t,e),c(t,l,e),g&&g.m(t,e),c(t,a,e),h&&h.m(t,e),c(t,i,e);},p(t,[e]){t[0].label?u?u.p(t,e):(u=W(t),u.c(),u.m(n.parentNode,n)):u&&(u.d(1),u=null),"text"===t[0].type?p?p.p(t,e):(p=X(t),p.c(),p.m(o.parentNode,o)):p&&(p.d(1),p=null),"password"===t[0].type?_?_.p(t,e):(_=Z(t),_.c(),_.m(s.parentNode,s)):_&&(_.d(1),_=null),"email"===t[0].type?m?m.p(t,e):(m=tt(t),m.c(),m.m(l.parentNode,l)):m&&(m.d(1),m=null),"number"===t[0].type?g?g.p(t,e):(g=et(t),g.c(),g.m(a.parentNode,a)):g&&(g.d(1),g=null),"textarea"===t[0].type?h?h.p(t,e):(h=nt(t),h.c(),h.m(i.parentNode,i)):h&&(h.d(1),h=null);},i:t,o:t,d(t){u&&u.d(t),t&&r(n),p&&p.d(t),t&&r(o),_&&_.d(t),t&&r(s),m&&m.d(t),t&&r(l),g&&g.d(t),t&&r(a),h&&h.d(t),t&&r(i);}}}function st(t,e,n){let{input:o={}}=e;return t.$$set=t=>{"input"in t&&n(0,o=t.input);},[o,function(){o.value=this.value,n(0,o);},function(){o.value=this.value,n(0,o);},function(){o.value=this.value,n(0,o);},function(){o.value=g(this.value),n(0,o);},function(){o.value=this.value,n(0,o);}]}class lt extends Y{constructor(t){super(),S(this,t,st,ot,l,{input:0},V);}}function at(t){i(t,"svelte-1iljf4q",".ec_alert_container.svelte-1iljf4q{justify-content:center;align-items:baseline;position:fixed;color:#40464f;display:flex;top:0;left:0;width:100vw;height:100vh;z-index:9999}.ec_alert_container.svelte-1iljf4q,.ec_alert_container.svelte-1iljf4q *{box-sizing:border-box}.ec_alert_overlay.svelte-1iljf4q{position:fixed;top:0;left:0;width:100vw;height:100vh;backdrop-filter:blur(1px);background-color:rgba(13, 15, 21, .35)}.ec_alert.svelte-1iljf4q{background-color:#fff;z-index:1;margin-top:40px;border-radius:5px;width:min(100%, 500px);padding:25px 20px 20px;box-shadow:0px 5px 10px rgb(0 0 0 / 15%);animation:svelte-16wze0k-ec_animation 1s}@keyframes svelte-1iljf4q-ec_animation{from{transform:translateY(25px)}to{transform:translateY(0)}}.ec_alert_controllers.svelte-1iljf4q{justify-content:flex-end;align-items:center;display:flex;grid-gap:15px;margin-top:20px}button.svelte-1iljf4q{background-color:unset;cursor:pointer;border:none;padding:10px 25px;border-radius:5px;box-shadow:3px 3px 10px 0px rgb(0 0 0 / 30%)}button.accept.svelte-1iljf4q{color:#3b60df}");}function it(t,e,n){const o=t.slice();return o[13]=e[n],o[14]=e,o[15]=n,o}function ct(t){let e,n,s,l,i,d,g,x,v,y,b,$,k,w,q,j=t[5],C=[];for(let e=0;e<j.length;e+=1)C[e]=rt(it(t,j,e));const N=t=>M(C[t],1,1,(()=>{C[t]=null;}));let B=t[0]&&ut(t);return {c(){e=u("div"),n=u("div"),s=f(),l=u("div"),i=u("section"),d=p(t[1]),g=f();for(let t=0;t<C.length;t+=1)C[t].c();x=f(),v=u("section"),B&&B.c(),y=f(),b=u("button"),$=p(t[3]),m(n,"class","ec_alert_overlay svelte-1iljf4q"),m(i,"class","ec_alert_message"),m(b,"class","accept svelte-1iljf4q"),m(v,"class","ec_alert_controllers svelte-1iljf4q"),m(l,"class","ec_alert svelte-1iljf4q"),m(e,"class","ec_alert_container svelte-1iljf4q");},m(o,r){c(o,e,r),a(e,n),a(e,s),a(e,l),a(l,i),a(i,d),a(i,g);for(let t=0;t<C.length;t+=1)C[t].m(i,null);a(l,x),a(l,v),B&&B.m(v,null),a(v,y),a(v,b),a(b,$),k=!0,w||(q=[_(n,"click",t[9]),_(b,"click",t[12])],w=!0);},p(t,e){if((!k||2&e)&&h(d,t[1]),32&e){let n;for(j=t[5],n=0;n<j.length;n+=1){const o=it(t,j,n);C[n]?(C[n].p(o,e),U(C[n],1)):(C[n]=rt(o),C[n].c(),U(C[n],1),C[n].m(i,null));}for(D(),n=j.length;n<C.length;n+=1)N(n);z();}t[0]?B?B.p(t,e):(B=ut(t),B.c(),B.m(v,y)):B&&(B.d(1),B=null),(!k||8&e)&&h($,t[3]);},i(t){if(!k){for(let t=0;t<j.length;t+=1)U(C[t]);k=!0;}},o(t){C=C.filter(Boolean);for(let t=0;t<C.length;t+=1)M(C[t]);k=!1;},d(t){t&&r(e),function(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e);}(C,t),B&&B.d(),w=!1,o(q);}}}function rt(t){let e,n,o;function s(e){t[10](e,t[13],t[14],t[15]);}let l={};return void 0!==t[13]&&(l.input=t[13]),e=new lt({props:l}),$.push((()=>function(t,e,n){const o=t.$$.props[e];void 0!==o&&(t.$$.bound[o]=n,n(t.$$.ctx[o]));}(e,"input",s))),{c(){var t;(t=e.$$.fragment)&&t.c();},m(t,n){O(e,t,n),o=!0;},p(o,s){t=o;const l={};var a;!n&&32&s&&(n=!0,l.input=t[13],a=()=>n=!1,w.push(a)),e.$set(l);},i(t){o||(U(e.$$.fragment,t),o=!0);},o(t){M(e.$$.fragment,t),o=!1;},d(t){P(e,t);}}}function ut(t){let e,n,o,s;return {c(){e=u("button"),n=p(t[2]),m(e,"class","svelte-1iljf4q");},m(l,i){c(l,e,i),a(e,n),o||(s=_(e,"click",t[11]),o=!0);},p(t,e){4&e&&h(n,t[2]);},d(t){t&&r(e),o=!1,s();}}}function pt(t){let e,n,o=t[4]&&ct(t);return {c(){o&&o.c(),e=d();},m(t,s){o&&o.m(t,s),c(t,e,s),n=!0;},p(t,[n]){t[4]?o?(o.p(t,n),16&n&&U(o,1)):(o=ct(t),o.c(),U(o,1),o.m(e.parentNode,e)):o&&(D(),M(o,1,1,(()=>{o=null;})),z());},i(t){n||(U(o),n=!0);},o(t){M(o),n=!1;},d(t){o&&o.d(t),t&&r(e);}}}function ft(t,e,n){let{showCancelButton:o=!0}=e,{message:s=""}=e,{cancel:l=""}=e,{accept:a=""}=e,{inputs:i=[]}=e,{resolve:c=(()=>{})}=e,r=!0,u=i.map((t=>({...t,name:t.name||t.label?t.label.toLowerCase().replace(/\s/g,"_"):""})));const p=t=>{n(4,r=!1),t&&u.length?c(u):c(t);};return t.$$set=t=>{"showCancelButton"in t&&n(0,o=t.showCancelButton),"message"in t&&n(1,s=t.message),"cancel"in t&&n(2,l=t.cancel),"accept"in t&&n(3,a=t.accept),"inputs"in t&&n(7,i=t.inputs),"resolve"in t&&n(8,c=t.resolve);},[o,s,l,a,r,u,p,i,c,()=>p(!o),function(t,e,o,s){o[s]=t,n(5,u);},()=>p(!1),()=>p(!0)]}class dt extends Y{constructor(t){super(),S(this,t,ft,pt,l,{showCancelButton:0,message:1,cancel:2,accept:3,inputs:7,resolve:8},at);}}const _t=(...t)=>Q(...t),mt=t=>(t=(t=>{const e=(t=t||{}).message||"",n=t.accept||"Accept",o=t.cancel||"Cancel",s=t.position||"top",l=!1!==t.showCancelButton;return {inputs:t.inputs?.constructor===Array?t.inputs:[],accept:n,cancel:o,message:e,position:s,showCancelButton:l}})(t),new Promise((e=>{new dt({target:document.body,props:{...t,resolve(t){e(t);}}});})));

    const alertCode = {

    	code_height: '205px',
    	title: 'Simple Alert',
    	// description: 'Create a simple alert dialog.',
    	args: {
    		message: 'Alert message',
    		showCancelButton: false,
    		accept: 'Accept'
    	},
    	code : `
		import { useAlert } from '@migueleraso/alerts_components'

		export const alert = (message) => {
			useAlert({
				message: message || 'Alert message',
				showCancelButton: false,
				accept: 'Accept',
			})
		}`,
    };

    const confirmCode = {

    	code_height: '205px',
    	title: 'Confirm',
    	description: '',
    	args: {
    		message: 'Confirm message',
    		accept: 'Accept',
    		cancel: 'Cancel',
    	},
    	code : `
	import { useAlert } from '@migueleraso/alerts_components'

	export const confirm = async (message) => {
		return await useAlert({
			message: message || 'Confirm message',
			accept: 'Accept',
			cancel: 'Cancel',
		})
	}`,
    };

    const promptCode = {

    	code_height: '540px',
    	title: 'Prompt',
    	description: '',
    	args: {
    		message: 'Prompt message',
    		accept: 'Accept',
    		cancel: 'Cancel',
    		inputs: [
    			{
    				label: 'Name',
    				name: 'name',
    				type: 'text',
    				placeholder: 'Enter your name'
    			},
    			{
    				label: 'Age',
    				name: 'age',
    				type: 'number',
    				placeholder: 'Enter your age'
    			},
    			{
    				type: 'textarea'
    			}
    		]
    	},
    	code : `
	import { useAlert } from '@migueleraso/alerts_components'

	export const confirm = async (message) => {
		return await useAlert({
			message: message || 'Prompt message',
			accept: 'Accept',
			cancel: 'Cancel',
			inputs: [
				{
					label: 'Name',
					name: 'name',
					type: 'text',
					placeholder: 'Enter your name'
				},
				{
					label: 'Age',
					name: 'age',
					type: 'number',
					placeholder: 'Enter your age'
				},
				{
					type: 'textarea'
				}
			]
		})
	}`,
    };

    const toastCode = {

    	code_height: '300px',
    	title: 'Toast',
    	description: `
		types: success, info, warning, danger, dark, light
		<br />
		positions: top-left, top-right, bottom-right, bottom-left
	`,
    	code : `
	import { useToast } from '@migueleraso/alerts_components'

	const successToast = useToast({
		defaultMessage: 'Success',
		type: 'success',
		duration: 3000, // default 5000
		position: 'bottom-left',
		dismissable: true,
		onDismiss: (args) => {
			console.log(args)
		}
	})

	successToast('Success toast')`,
    };

    const copyTextToClipboard = (text) => {

    	const textArea = document.createElement("textarea");

    	textArea.style.position = 'fixed';
    	textArea.style.top = 0;
    	textArea.style.left = 0;
    	textArea.style.width = '2em';
    	textArea.style.height = '2em';

    	textArea.style.color = 'transparent';
    	textArea.style.background = 'transparent';

    	textArea.value = text;

    	document.body.appendChild(textArea);
    	textArea.focus();
    	textArea.select();

    	try {
    		const successful = document.execCommand('copy');

    		if (successful) {
    			_t({ type: 'success' })
    			('Copied to clipboard');
    		}

    	} catch (err) {

    	}

    	document.body.removeChild(textArea);
    };



    const getCode = (string) => {
    	let code = string.replaceAll('	', '  ').replace('\n', '');

    	return code
    };

    var BACKGROUND_COLOR="#fff",LINE_HEIGHT="20px",FONT_SIZE="13px",defaultCssTheme="\n.codeflask {\n  background: "+BACKGROUND_COLOR+";\n  color: #4f559c;\n}\n\n.codeflask .token.punctuation {\n  color: #4a4a4a;\n}\n\n.codeflask .token.keyword {\n  color: #8500ff;\n}\n\n.codeflask .token.operator {\n  color: #ff5598;\n}\n\n.codeflask .token.string {\n  color: #41ad8f;\n}\n\n.codeflask .token.comment {\n  color: #9badb7;\n}\n\n.codeflask .token.function {\n  color: #8500ff;\n}\n\n.codeflask .token.boolean {\n  color: #8500ff;\n}\n\n.codeflask .token.number {\n  color: #8500ff;\n}\n\n.codeflask .token.selector {\n  color: #8500ff;\n}\n\n.codeflask .token.property {\n  color: #8500ff;\n}\n\n.codeflask .token.tag {\n  color: #8500ff;\n}\n\n.codeflask .token.attr-value {\n  color: #8500ff;\n}\n";function cssSupports(e,t){return "undefined"!=typeof CSS?CSS.supports(e,t):"undefined"!=typeof document&&toCamelCase(e)in document.body.style}function toCamelCase(e){return (e=e.split("-").filter(function(e){return !!e}).map(function(e){return e[0].toUpperCase()+e.substr(1)}).join(""))[0].toLowerCase()+e.substr(1)}var FONT_FAMILY='"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',COLOR=cssSupports("caret-color","#000")?BACKGROUND_COLOR:"#ccc",LINE_NUMBER_WIDTH="40px",editorCss="\n  .codeflask {\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    overflow: hidden;\n  }\n\n  .codeflask, .codeflask * {\n    box-sizing: border-box;\n  }\n\n  .codeflask__pre {\n    pointer-events: none;\n    z-index: 3;\n    overflow: hidden;\n  }\n\n  .codeflask__textarea {\n    background: none;\n    border: none;\n    color: "+COLOR+";\n    z-index: 1;\n    resize: none;\n    font-family: "+FONT_FAMILY+";\n    -webkit-appearance: pre;\n    caret-color: #111;\n    z-index: 2;\n    width: 100%;\n    height: 100%;\n  }\n\n  .codeflask--has-line-numbers .codeflask__textarea {\n    width: calc(100% - "+LINE_NUMBER_WIDTH+");\n  }\n\n  .codeflask__code {\n    display: block;\n    font-family: "+FONT_FAMILY+";\n    overflow: hidden;\n  }\n\n  .codeflask__flatten {\n    padding: 10px;\n    font-size: "+FONT_SIZE+";\n    line-height: "+LINE_HEIGHT+";\n    white-space: pre;\n    position: absolute;\n    top: 0;\n    left: 0;\n    overflow: auto;\n    margin: 0 !important;\n    outline: none;\n    text-align: left;\n  }\n\n  .codeflask--has-line-numbers .codeflask__flatten {\n    width: calc(100% - "+LINE_NUMBER_WIDTH+");\n    left: "+LINE_NUMBER_WIDTH+";\n  }\n\n  .codeflask__line-highlight {\n    position: absolute;\n    top: 10px;\n    left: 0;\n    width: 100%;\n    height: "+LINE_HEIGHT+";\n    background: rgba(0,0,0,0.1);\n    z-index: 1;\n  }\n\n  .codeflask__lines {\n    padding: 10px 4px;\n    font-size: 12px;\n    line-height: "+LINE_HEIGHT+";\n    font-family: 'Cousine', monospace;\n    position: absolute;\n    left: 0;\n    top: 0;\n    width: "+LINE_NUMBER_WIDTH+";\n    height: 100%;\n    text-align: right;\n    color: #999;\n    z-index: 2;\n  }\n\n  .codeflask__lines__line {\n    display: block;\n  }\n\n  .codeflask.codeflask--has-line-numbers {\n    padding-left: "+LINE_NUMBER_WIDTH+";\n  }\n\n  .codeflask.codeflask--has-line-numbers:before {\n    content: '';\n    position: absolute;\n    left: 0;\n    top: 0;\n    width: "+LINE_NUMBER_WIDTH+";\n    height: 100%;\n    background: #eee;\n    z-index: 1;\n  }\n";function injectCss(e,t,n){var a=t||"codeflask-style",s=n||document.head;if(!e)return !1;if(document.getElementById(a))return !0;var o=document.createElement("style");return o.innerHTML=e,o.id=a,s.appendChild(o),!0}var entityMap={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;","`":"&#x60;","=":"&#x3D;"};function escapeHtml(e){return String(e).replace(/[&<>"'`=/]/g,function(e){return entityMap[e]})}var commonjsGlobal="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function createCommonjsModule(e,t){return e(t={exports:{}},t.exports),t.exports}var prism=createCommonjsModule(function(e){var t=function(e){var t=/\blang(?:uage)?-([\w-]+)\b/i,n=0,a={manual:e.Prism&&e.Prism.manual,disableWorkerMessageHandler:e.Prism&&e.Prism.disableWorkerMessageHandler,util:{encode:function(e){return e instanceof s?new s(e.type,a.util.encode(e.content),e.alias):Array.isArray(e)?e.map(a.util.encode):e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\u00a0/g," ")},type:function(e){return Object.prototype.toString.call(e).slice(8,-1)},objId:function(e){return e.__id||Object.defineProperty(e,"__id",{value:++n}),e.__id},clone:function e(t,n){var s,o,i=a.util.type(t);switch(n=n||{},i){case"Object":if(o=a.util.objId(t),n[o])return n[o];for(var r in s={},n[o]=s,t)t.hasOwnProperty(r)&&(s[r]=e(t[r],n));return s;case"Array":return o=a.util.objId(t),n[o]?n[o]:(s=[],n[o]=s,t.forEach(function(t,a){s[a]=e(t,n);}),s);default:return t}}},languages:{extend:function(e,t){var n=a.util.clone(a.languages[e]);for(var s in t)n[s]=t[s];return n},insertBefore:function(e,t,n,s){var o=(s=s||a.languages)[e],i={};for(var r in o)if(o.hasOwnProperty(r)){if(r==t)for(var l in n)n.hasOwnProperty(l)&&(i[l]=n[l]);n.hasOwnProperty(r)||(i[r]=o[r]);}var c=s[e];return s[e]=i,a.languages.DFS(a.languages,function(t,n){n===c&&t!=e&&(this[t]=i);}),i},DFS:function e(t,n,s,o){o=o||{};var i=a.util.objId;for(var r in t)if(t.hasOwnProperty(r)){n.call(t,r,t[r],s||r);var l=t[r],c=a.util.type(l);"Object"!==c||o[i(l)]?"Array"!==c||o[i(l)]||(o[i(l)]=!0,e(l,n,r,o)):(o[i(l)]=!0,e(l,n,null,o));}}},plugins:{},highlightAll:function(e,t){a.highlightAllUnder(document,e,t);},highlightAllUnder:function(e,t,n){var s={callback:n,selector:'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'};a.hooks.run("before-highlightall",s);for(var o,i=s.elements||e.querySelectorAll(s.selector),r=0;o=i[r++];)a.highlightElement(o,!0===t,s.callback);},highlightElement:function(n,s,o){for(var i,r,l=n;l&&!t.test(l.className);)l=l.parentNode;l&&(i=(l.className.match(t)||[,""])[1].toLowerCase(),r=a.languages[i]),n.className=n.className.replace(t,"").replace(/\s+/g," ")+" language-"+i,n.parentNode&&(l=n.parentNode,/pre/i.test(l.nodeName)&&(l.className=l.className.replace(t,"").replace(/\s+/g," ")+" language-"+i));var c={element:n,language:i,grammar:r,code:n.textContent},d=function(e){c.highlightedCode=e,a.hooks.run("before-insert",c),c.element.innerHTML=c.highlightedCode,a.hooks.run("after-highlight",c),a.hooks.run("complete",c),o&&o.call(c.element);};if(a.hooks.run("before-sanity-check",c),c.code)if(a.hooks.run("before-highlight",c),c.grammar)if(s&&e.Worker){var u=new Worker(a.filename);u.onmessage=function(e){d(e.data);},u.postMessage(JSON.stringify({language:c.language,code:c.code,immediateClose:!0}));}else d(a.highlight(c.code,c.grammar,c.language));else d(a.util.encode(c.code));else a.hooks.run("complete",c);},highlight:function(e,t,n){var o={code:e,grammar:t,language:n};return a.hooks.run("before-tokenize",o),o.tokens=a.tokenize(o.code,o.grammar),a.hooks.run("after-tokenize",o),s.stringify(a.util.encode(o.tokens),o.language)},matchGrammar:function(e,t,n,o,i,r,l){for(var c in n)if(n.hasOwnProperty(c)&&n[c]){if(c==l)return;var d=n[c];d="Array"===a.util.type(d)?d:[d];for(var u=0;u<d.length;++u){var p=d[u],h=p.inside,g=!!p.lookbehind,f=!!p.greedy,m=0,b=p.alias;if(f&&!p.pattern.global){var k=p.pattern.toString().match(/[imuy]*$/)[0];p.pattern=RegExp(p.pattern.source,k+"g");}p=p.pattern||p;for(var y=o,C=i;y<t.length;C+=t[y].length,++y){var F=t[y];if(t.length>e.length)return;if(!(F instanceof s)){if(f&&y!=t.length-1){if(p.lastIndex=C,!(T=p.exec(e)))break;for(var v=T.index+(g?T[1].length:0),x=T.index+T[0].length,w=y,A=C,_=t.length;w<_&&(A<x||!t[w].type&&!t[w-1].greedy);++w)v>=(A+=t[w].length)&&(++y,C=A);if(t[y]instanceof s)continue;E=w-y,F=e.slice(C,A),T.index-=C;}else {p.lastIndex=0;var T=p.exec(F),E=1;}if(T){g&&(m=T[1]?T[1].length:0);x=(v=T.index+m)+(T=T[0].slice(m)).length;var L=F.slice(0,v),N=F.slice(x),S=[y,E];L&&(++y,C+=L.length,S.push(L));var I=new s(c,h?a.tokenize(T,h):T,b,T,f);if(S.push(I),N&&S.push(N),Array.prototype.splice.apply(t,S),1!=E&&a.matchGrammar(e,t,n,y,C,!0,c),r)break}else if(r)break}}}}},tokenize:function(e,t){var n=[e],s=t.rest;if(s){for(var o in s)t[o]=s[o];delete t.rest;}return a.matchGrammar(e,n,t,0,0,!1),n},hooks:{all:{},add:function(e,t){var n=a.hooks.all;n[e]=n[e]||[],n[e].push(t);},run:function(e,t){var n=a.hooks.all[e];if(n&&n.length)for(var s,o=0;s=n[o++];)s(t);}},Token:s};function s(e,t,n,a,s){this.type=e,this.content=t,this.alias=n,this.length=0|(a||"").length,this.greedy=!!s;}if(e.Prism=a,s.stringify=function(e,t,n){if("string"==typeof e)return e;if(Array.isArray(e))return e.map(function(n){return s.stringify(n,t,e)}).join("");var o={type:e.type,content:s.stringify(e.content,t,n),tag:"span",classes:["token",e.type],attributes:{},language:t,parent:n};if(e.alias){var i=Array.isArray(e.alias)?e.alias:[e.alias];Array.prototype.push.apply(o.classes,i);}a.hooks.run("wrap",o);var r=Object.keys(o.attributes).map(function(e){return e+'="'+(o.attributes[e]||"").replace(/"/g,"&quot;")+'"'}).join(" ");return "<"+o.tag+' class="'+o.classes.join(" ")+'"'+(r?" "+r:"")+">"+o.content+"</"+o.tag+">"},!e.document)return e.addEventListener?(a.disableWorkerMessageHandler||e.addEventListener("message",function(t){var n=JSON.parse(t.data),s=n.language,o=n.code,i=n.immediateClose;e.postMessage(a.highlight(o,a.languages[s],s)),i&&e.close();},!1),a):a;var o=document.currentScript||[].slice.call(document.getElementsByTagName("script")).pop();return o&&(a.filename=o.src,a.manual||o.hasAttribute("data-manual")||("loading"!==document.readyState?window.requestAnimationFrame?window.requestAnimationFrame(a.highlightAll):window.setTimeout(a.highlightAll,16):document.addEventListener("DOMContentLoaded",a.highlightAll))),a}("undefined"!=typeof window?window:"undefined"!=typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope?self:{});e.exports&&(e.exports=t),void 0!==commonjsGlobal&&(commonjsGlobal.Prism=t),t.languages.markup={comment:/<!--[\s\S]*?-->/,prolog:/<\?[\s\S]+?\?>/,doctype:/<!DOCTYPE[\s\S]+?>/i,cdata:/<!\[CDATA\[[\s\S]*?]]>/i,tag:{pattern:/<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/i,greedy:!0,inside:{tag:{pattern:/^<\/?[^\s>\/]+/i,inside:{punctuation:/^<\/?/,namespace:/^[^\s>\/:]+:/}},"attr-value":{pattern:/=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,inside:{punctuation:[/^=/,{pattern:/^(\s*)["']|["']$/,lookbehind:!0}]}},punctuation:/\/?>/,"attr-name":{pattern:/[^\s>\/]+/,inside:{namespace:/^[^\s>\/:]+:/}}}},entity:/&#?[\da-z]{1,8};/i},t.languages.markup.tag.inside["attr-value"].inside.entity=t.languages.markup.entity,t.hooks.add("wrap",function(e){"entity"===e.type&&(e.attributes.title=e.content.replace(/&amp;/,"&"));}),Object.defineProperty(t.languages.markup.tag,"addInlined",{value:function(e,n){var a={};a["language-"+n]={pattern:/(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,lookbehind:!0,inside:t.languages[n]},a.cdata=/^<!\[CDATA\[|\]\]>$/i;var s={"included-cdata":{pattern:/<!\[CDATA\[[\s\S]*?\]\]>/i,inside:a}};s["language-"+n]={pattern:/[\s\S]+/,inside:t.languages[n]};var o={};o[e]={pattern:RegExp(/(<__[\s\S]*?>)(?:<!\[CDATA\[[\s\S]*?\]\]>\s*|[\s\S])*?(?=<\/__>)/.source.replace(/__/g,e),"i"),lookbehind:!0,greedy:!0,inside:s},t.languages.insertBefore("markup","cdata",o);}}),t.languages.xml=t.languages.extend("markup",{}),t.languages.html=t.languages.markup,t.languages.mathml=t.languages.markup,t.languages.svg=t.languages.markup,function(e){var t=/("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;e.languages.css={comment:/\/\*[\s\S]*?\*\//,atrule:{pattern:/@[\w-]+?[\s\S]*?(?:;|(?=\s*\{))/i,inside:{rule:/@[\w-]+/}},url:RegExp("url\\((?:"+t.source+"|.*?)\\)","i"),selector:RegExp("[^{}\\s](?:[^{};\"']|"+t.source+")*?(?=\\s*\\{)"),string:{pattern:t,greedy:!0},property:/[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,important:/!important\b/i,function:/[-a-z0-9]+(?=\()/i,punctuation:/[(){};:,]/},e.languages.css.atrule.inside.rest=e.languages.css;var n=e.languages.markup;n&&(n.tag.addInlined("style","css"),e.languages.insertBefore("inside","attr-value",{"style-attr":{pattern:/\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,inside:{"attr-name":{pattern:/^\s*style/i,inside:n.tag.inside},punctuation:/^\s*=\s*['"]|['"]\s*$/,"attr-value":{pattern:/.+/i,inside:e.languages.css}},alias:"language-css"}},n.tag));}(t),t.languages.clike={comment:[{pattern:/(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,lookbehind:!0},{pattern:/(^|[^\\:])\/\/.*/,lookbehind:!0,greedy:!0}],string:{pattern:/(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,greedy:!0},"class-name":{pattern:/((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,lookbehind:!0,inside:{punctuation:/[.\\]/}},keyword:/\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,boolean:/\b(?:true|false)\b/,function:/\w+(?=\()/,number:/\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,operator:/--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,punctuation:/[{}[\];(),.:]/},t.languages.javascript=t.languages.extend("clike",{"class-name":[t.languages.clike["class-name"],{pattern:/(^|[^$\w\xA0-\uFFFF])[_$A-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\.(?:prototype|constructor))/,lookbehind:!0}],keyword:[{pattern:/((?:^|})\s*)(?:catch|finally)\b/,lookbehind:!0},{pattern:/(^|[^.])\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,lookbehind:!0}],number:/\b(?:(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+)n?|\d+n|NaN|Infinity)\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,function:/[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,operator:/-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/}),t.languages.javascript["class-name"][0].pattern=/(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/,t.languages.insertBefore("javascript","keyword",{regex:{pattern:/((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})\]]))/,lookbehind:!0,greedy:!0},"function-variable":{pattern:/[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/,alias:"function"},parameter:[{pattern:/(function(?:\s+[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)?\s*\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\))/,lookbehind:!0,inside:t.languages.javascript},{pattern:/[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=>)/i,inside:t.languages.javascript},{pattern:/(\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*=>)/,lookbehind:!0,inside:t.languages.javascript},{pattern:/((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*\s*)\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*\{)/,lookbehind:!0,inside:t.languages.javascript}],constant:/\b[A-Z](?:[A-Z_]|\dx?)*\b/}),t.languages.insertBefore("javascript","string",{"template-string":{pattern:/`(?:\\[\s\S]|\${[^}]+}|[^\\`])*`/,greedy:!0,inside:{interpolation:{pattern:/\${[^}]+}/,inside:{"interpolation-punctuation":{pattern:/^\${|}$/,alias:"punctuation"},rest:t.languages.javascript}},string:/[\s\S]+/}}}),t.languages.markup&&t.languages.markup.tag.addInlined("script","javascript"),t.languages.js=t.languages.javascript,"undefined"!=typeof self&&self.Prism&&self.document&&document.querySelector&&(self.Prism.fileHighlight=function(e){e=e||document;var n={js:"javascript",py:"python",rb:"ruby",ps1:"powershell",psm1:"powershell",sh:"bash",bat:"batch",h:"c",tex:"latex"};Array.prototype.slice.call(e.querySelectorAll("pre[data-src]")).forEach(function(e){if(!e.hasAttribute("data-src-loaded")){for(var a,s=e.getAttribute("data-src"),o=e,i=/\blang(?:uage)?-([\w-]+)\b/i;o&&!i.test(o.className);)o=o.parentNode;if(o&&(a=(e.className.match(i)||[,""])[1]),!a){var r=(s.match(/\.(\w+)$/)||[,""])[1];a=n[r]||r;}var l=document.createElement("code");l.className="language-"+a,e.textContent="",l.textContent="Loading…",e.appendChild(l);var c=new XMLHttpRequest;c.open("GET",s,!0),c.onreadystatechange=function(){4==c.readyState&&(c.status<400&&c.responseText?(l.textContent=c.responseText,t.highlightElement(l),e.setAttribute("data-src-loaded","")):c.status>=400?l.textContent="✖ Error "+c.status+" while fetching file: "+c.statusText:l.textContent="✖ Error: File does not exist or is empty");},c.send(null);}}),t.plugins.toolbar&&t.plugins.toolbar.registerButton("download-file",function(e){var t=e.element.parentNode;if(t&&/pre/i.test(t.nodeName)&&t.hasAttribute("data-src")&&t.hasAttribute("data-download-link")){var n=t.getAttribute("data-src"),a=document.createElement("a");return a.textContent=t.getAttribute("data-download-link-label")||"Download",a.setAttribute("download",""),a.href=n,a}});},document.addEventListener("DOMContentLoaded",function(){self.Prism.fileHighlight();}));}),CodeFlask=function(e,t){if(!e)throw Error("CodeFlask expects a parameter which is Element or a String selector");if(!t)throw Error("CodeFlask expects an object containing options as second parameter");if(e.nodeType)this.editorRoot=e;else {var n=document.querySelector(e);n&&(this.editorRoot=n);}this.opts=t,this.startEditor();};CodeFlask.prototype.startEditor=function(){if(!injectCss(editorCss,null,this.opts.styleParent))throw Error("Failed to inject CodeFlask CSS.");this.createWrapper(),this.createTextarea(),this.createPre(),this.createCode(),this.runOptions(),this.listenTextarea(),this.populateDefault(),this.updateCode(this.code);},CodeFlask.prototype.createWrapper=function(){this.code=this.editorRoot.innerHTML,this.editorRoot.innerHTML="",this.elWrapper=this.createElement("div",this.editorRoot),this.elWrapper.classList.add("codeflask");},CodeFlask.prototype.createTextarea=function(){this.elTextarea=this.createElement("textarea",this.elWrapper),this.elTextarea.classList.add("codeflask__textarea","codeflask__flatten");},CodeFlask.prototype.createPre=function(){this.elPre=this.createElement("pre",this.elWrapper),this.elPre.classList.add("codeflask__pre","codeflask__flatten");},CodeFlask.prototype.createCode=function(){this.elCode=this.createElement("code",this.elPre),this.elCode.classList.add("codeflask__code","language-"+(this.opts.language||"html"));},CodeFlask.prototype.createLineNumbers=function(){this.elLineNumbers=this.createElement("div",this.elWrapper),this.elLineNumbers.classList.add("codeflask__lines"),this.setLineNumber();},CodeFlask.prototype.createElement=function(e,t){var n=document.createElement(e);return t.appendChild(n),n},CodeFlask.prototype.runOptions=function(){this.opts.rtl=this.opts.rtl||!1,this.opts.tabSize=this.opts.tabSize||2,this.opts.enableAutocorrect=this.opts.enableAutocorrect||!1,this.opts.lineNumbers=this.opts.lineNumbers||!1,this.opts.defaultTheme=!1!==this.opts.defaultTheme,this.opts.areaId=this.opts.areaId||null,this.opts.ariaLabelledby=this.opts.ariaLabelledby||null,this.opts.readonly=this.opts.readonly||null,"boolean"!=typeof this.opts.handleTabs&&(this.opts.handleTabs=!0),"boolean"!=typeof this.opts.handleSelfClosingCharacters&&(this.opts.handleSelfClosingCharacters=!0),"boolean"!=typeof this.opts.handleNewLineIndentation&&(this.opts.handleNewLineIndentation=!0),!0===this.opts.rtl&&(this.elTextarea.setAttribute("dir","rtl"),this.elPre.setAttribute("dir","rtl")),!1===this.opts.enableAutocorrect&&(this.elTextarea.setAttribute("spellcheck","false"),this.elTextarea.setAttribute("autocapitalize","off"),this.elTextarea.setAttribute("autocomplete","off"),this.elTextarea.setAttribute("autocorrect","off")),this.opts.lineNumbers&&(this.elWrapper.classList.add("codeflask--has-line-numbers"),this.createLineNumbers()),this.opts.defaultTheme&&injectCss(defaultCssTheme,"theme-default",this.opts.styleParent),this.opts.areaId&&this.elTextarea.setAttribute("id",this.opts.areaId),this.opts.ariaLabelledby&&this.elTextarea.setAttribute("aria-labelledby",this.opts.ariaLabelledby),this.opts.readonly&&this.enableReadonlyMode();},CodeFlask.prototype.updateLineNumbersCount=function(){for(var e="",t=1;t<=this.lineNumber;t++)e=e+'<span class="codeflask__lines__line">'+t+"</span>";this.elLineNumbers.innerHTML=e;},CodeFlask.prototype.listenTextarea=function(){var e=this;this.elTextarea.addEventListener("input",function(t){e.code=t.target.value,e.elCode.innerHTML=escapeHtml(t.target.value),e.highlight(),setTimeout(function(){e.runUpdate(),e.setLineNumber();},1);}),this.elTextarea.addEventListener("keydown",function(t){e.handleTabs(t),e.handleSelfClosingCharacters(t),e.handleNewLineIndentation(t);}),this.elTextarea.addEventListener("scroll",function(t){e.elPre.style.transform="translate3d(-"+t.target.scrollLeft+"px, -"+t.target.scrollTop+"px, 0)",e.elLineNumbers&&(e.elLineNumbers.style.transform="translate3d(0, -"+t.target.scrollTop+"px, 0)");});},CodeFlask.prototype.handleTabs=function(e){if(this.opts.handleTabs){if(9!==e.keyCode)return;e.preventDefault();var t=this.elTextarea,n=t.selectionDirection,a=t.selectionStart,s=t.selectionEnd,o=t.value,i=o.substr(0,a),r=o.substring(a,s),l=o.substring(s),c=" ".repeat(this.opts.tabSize);if(a!==s&&r.length>=c.length){var d=a-i.split("\n").pop().length,u=c.length,p=c.length;if(e.shiftKey)o.substr(d,c.length)===c?(u=-u,d>a?(r=r.substring(0,d)+r.substring(d+c.length),p=0):d===a?(u=0,p=0,r=r.substring(c.length)):(p=-p,i=i.substring(0,d)+i.substring(d+c.length))):(u=0,p=0),r=r.replace(new RegExp("\n"+c.split("").join("\\"),"g"),"\n");else i=i.substr(0,d)+c+i.substring(d,a),r=r.replace(/\n/g,"\n"+c);t.value=i+r+l,t.selectionStart=a+u,t.selectionEnd=a+r.length+p,t.selectionDirection=n;}else t.value=i+c+l,t.selectionStart=a+c.length,t.selectionEnd=a+c.length;var h=t.value;this.updateCode(h),this.elTextarea.selectionEnd=s+this.opts.tabSize;}},CodeFlask.prototype.handleSelfClosingCharacters=function(e){if(this.opts.handleSelfClosingCharacters){var t=e.key;if(["(","[","{","<","'",'"'].includes(t)||[")","]","}",">","'",'"'].includes(t))switch(t){case"(":case")":this.closeCharacter(t);break;case"[":case"]":this.closeCharacter(t);break;case"{":case"}":this.closeCharacter(t);break;case"<":case">":case"'":case'"':this.closeCharacter(t);}}},CodeFlask.prototype.setLineNumber=function(){this.lineNumber=this.code.split("\n").length,this.opts.lineNumbers&&this.updateLineNumbersCount();},CodeFlask.prototype.handleNewLineIndentation=function(e){if(this.opts.handleNewLineIndentation&&13===e.keyCode){e.preventDefault();var t=this.elTextarea,n=t.selectionStart,a=t.selectionEnd,s=t.value,o=s.substr(0,n),i=s.substring(a),r=s.lastIndexOf("\n",n-1),l=r+s.slice(r+1).search(/[^ ]|$/),c=l>r?l-r:0,d=o+"\n"+" ".repeat(c)+i;t.value=d,t.selectionStart=n+c+1,t.selectionEnd=n+c+1,this.updateCode(t.value);}},CodeFlask.prototype.closeCharacter=function(e){var t=this.elTextarea.selectionStart,n=this.elTextarea.selectionEnd;if(this.skipCloseChar(e)){var a=this.code.substr(n,1)===e,s=a?n+1:n,o=!a&&["'",'"'].includes(e)?e:"",i=""+this.code.substring(0,t)+o+this.code.substring(s);this.updateCode(i),this.elTextarea.selectionEnd=++this.elTextarea.selectionStart;}else {var r=e;switch(e){case"(":r=String.fromCharCode(e.charCodeAt()+1);break;case"<":case"{":case"[":r=String.fromCharCode(e.charCodeAt()+2);}var l=this.code.substring(t,n),c=""+this.code.substring(0,t)+l+r+this.code.substring(n);this.updateCode(c);}this.elTextarea.selectionEnd=t;},CodeFlask.prototype.skipCloseChar=function(e){var t=this.elTextarea.selectionStart,n=this.elTextarea.selectionEnd,a=Math.abs(n-t)>0;return [")","}","]",">"].includes(e)||["'",'"'].includes(e)&&!a},CodeFlask.prototype.updateCode=function(e){this.code=e,this.elTextarea.value=e,this.elCode.innerHTML=escapeHtml(e),this.highlight(),this.setLineNumber(),setTimeout(this.runUpdate.bind(this),1);},CodeFlask.prototype.updateLanguage=function(e){var t=this.opts.language;this.elCode.classList.remove("language-"+t),this.elCode.classList.add("language-"+e),this.opts.language=e,this.highlight();},CodeFlask.prototype.addLanguage=function(e,t){prism.languages[e]=t;},CodeFlask.prototype.populateDefault=function(){this.updateCode(this.code);},CodeFlask.prototype.highlight=function(){prism.highlightElement(this.elCode,!1);},CodeFlask.prototype.onUpdate=function(e){if(e&&"[object Function]"!=={}.toString.call(e))throw Error("CodeFlask expects callback of type Function");this.updateCallBack=e;},CodeFlask.prototype.getCode=function(){return this.code},CodeFlask.prototype.runUpdate=function(){this.updateCallBack&&this.updateCallBack(this.code);},CodeFlask.prototype.enableReadonlyMode=function(){this.elTextarea.setAttribute("readonly",!0);},CodeFlask.prototype.disableReadonlyMode=function(){this.elTextarea.removeAttribute("readonly");};

    /* src\components\codeDocumentation.svelte generated by Svelte v3.47.0 */
    const file$2 = "src\\components\\codeDocumentation.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let section0;
    	let t0;
    	let t1;
    	let section1;
    	let t2;
    	let section2;
    	let button0;
    	let t4;
    	let button1;
    	let t6;
    	let section3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			section0 = element("section");
    			t0 = text(/*title*/ ctx[2]);
    			t1 = space();
    			section1 = element("section");
    			t2 = space();
    			section2 = element("section");
    			button0 = element("button");
    			button0.textContent = "Run";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Copy";
    			t6 = space();
    			section3 = element("section");
    			attr_dev(section0, "class", "title svelte-1evg1zy");
    			add_location(section0, file$2, 28, 1, 544);
    			attr_dev(section1, "class", "description svelte-1evg1zy");
    			add_location(section1, file$2, 32, 1, 596);
    			attr_dev(button0, "class", "svelte-1evg1zy");
    			add_location(button0, file$2, 37, 2, 699);
    			attr_dev(button1, "class", "svelte-1evg1zy");
    			add_location(button1, file$2, 38, 2, 738);
    			attr_dev(section2, "class", "controllers svelte-1evg1zy");
    			add_location(section2, file$2, 36, 1, 666);
    			attr_dev(section3, "class", "editor svelte-1evg1zy");
    			set_style(section3, "height", /*code_height*/ ctx[4]);
    			add_location(section3, file$2, 41, 1, 821);
    			attr_dev(div, "class", "code_documentation svelte-1evg1zy");
    			add_location(div, file$2, 26, 0, 507);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, section0);
    			append_dev(section0, t0);
    			append_dev(div, t1);
    			append_dev(div, section1);
    			section1.innerHTML = /*description*/ ctx[3];
    			append_dev(div, t2);
    			append_dev(div, section2);
    			append_dev(section2, button0);
    			append_dev(section2, t4);
    			append_dev(section2, button1);
    			append_dev(div, t6);
    			append_dev(div, section3);
    			/*section3_binding*/ ctx[8](section3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*run*/ ctx[0])) /*run*/ ctx[0].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(button1, "click", /*click_handler*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			if (dirty & /*title*/ 4) set_data_dev(t0, /*title*/ ctx[2]);
    			if (dirty & /*description*/ 8) section1.innerHTML = /*description*/ ctx[3];
    			if (dirty & /*code_height*/ 16) {
    				set_style(section3, "height", /*code_height*/ ctx[4]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*section3_binding*/ ctx[8](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CodeDocumentation', slots, []);

    	let { run = () => {
    		
    	} } = $$props;

    	let { args = {} } = $$props;
    	let { code = '' } = $$props;
    	let { title = '' } = $$props;
    	let { description = '' } = $$props;
    	let { code_height = '' } = $$props;
    	let editorElement = null;

    	onMount(() => {
    		const flask = new CodeFlask(editorElement, { language: 'js', readonly: true });
    		flask.updateCode(getCode(code));
    	});

    	const writable_props = ['run', 'args', 'code', 'title', 'description', 'code_height'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CodeDocumentation> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => copyTextToClipboard(code);

    	function section3_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			editorElement = $$value;
    			$$invalidate(5, editorElement);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('run' in $$props) $$invalidate(0, run = $$props.run);
    		if ('args' in $$props) $$invalidate(6, args = $$props.args);
    		if ('code' in $$props) $$invalidate(1, code = $$props.code);
    		if ('title' in $$props) $$invalidate(2, title = $$props.title);
    		if ('description' in $$props) $$invalidate(3, description = $$props.description);
    		if ('code_height' in $$props) $$invalidate(4, code_height = $$props.code_height);
    	};

    	$$self.$capture_state = () => ({
    		getCode,
    		copyTextToClipboard,
    		onMount,
    		CodeFlask,
    		run,
    		args,
    		code,
    		title,
    		description,
    		code_height,
    		editorElement
    	});

    	$$self.$inject_state = $$props => {
    		if ('run' in $$props) $$invalidate(0, run = $$props.run);
    		if ('args' in $$props) $$invalidate(6, args = $$props.args);
    		if ('code' in $$props) $$invalidate(1, code = $$props.code);
    		if ('title' in $$props) $$invalidate(2, title = $$props.title);
    		if ('description' in $$props) $$invalidate(3, description = $$props.description);
    		if ('code_height' in $$props) $$invalidate(4, code_height = $$props.code_height);
    		if ('editorElement' in $$props) $$invalidate(5, editorElement = $$props.editorElement);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		run,
    		code,
    		title,
    		description,
    		code_height,
    		editorElement,
    		args,
    		click_handler,
    		section3_binding
    	];
    }

    class CodeDocumentation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			run: 0,
    			args: 6,
    			code: 1,
    			title: 2,
    			description: 3,
    			code_height: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CodeDocumentation",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get run() {
    		throw new Error("<CodeDocumentation>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set run(value) {
    		throw new Error("<CodeDocumentation>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get args() {
    		throw new Error("<CodeDocumentation>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set args(value) {
    		throw new Error("<CodeDocumentation>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get code() {
    		throw new Error("<CodeDocumentation>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set code(value) {
    		throw new Error("<CodeDocumentation>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<CodeDocumentation>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<CodeDocumentation>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<CodeDocumentation>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<CodeDocumentation>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get code_height() {
    		throw new Error("<CodeDocumentation>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set code_height(value) {
    		throw new Error("<CodeDocumentation>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Alert.svelte generated by Svelte v3.47.0 */

    function create_fragment$3(ctx) {
    	let codedocumentation0;
    	let t0;
    	let codedocumentation1;
    	let t1;
    	let codedocumentation2;
    	let current;
    	const codedocumentation0_spread_levels = [alertCode, { run: /*func*/ ctx[1] }];
    	let codedocumentation0_props = {};

    	for (let i = 0; i < codedocumentation0_spread_levels.length; i += 1) {
    		codedocumentation0_props = assign(codedocumentation0_props, codedocumentation0_spread_levels[i]);
    	}

    	codedocumentation0 = new CodeDocumentation({
    			props: codedocumentation0_props,
    			$$inline: true
    		});

    	const codedocumentation1_spread_levels = [confirmCode, { run: /*func_1*/ ctx[2] }];
    	let codedocumentation1_props = {};

    	for (let i = 0; i < codedocumentation1_spread_levels.length; i += 1) {
    		codedocumentation1_props = assign(codedocumentation1_props, codedocumentation1_spread_levels[i]);
    	}

    	codedocumentation1 = new CodeDocumentation({
    			props: codedocumentation1_props,
    			$$inline: true
    		});

    	const codedocumentation2_spread_levels = [promptCode, { run: /*func_2*/ ctx[3] }];
    	let codedocumentation2_props = {};

    	for (let i = 0; i < codedocumentation2_spread_levels.length; i += 1) {
    		codedocumentation2_props = assign(codedocumentation2_props, codedocumentation2_spread_levels[i]);
    	}

    	codedocumentation2 = new CodeDocumentation({
    			props: codedocumentation2_props,
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(codedocumentation0.$$.fragment);
    			t0 = space();
    			create_component(codedocumentation1.$$.fragment);
    			t1 = space();
    			create_component(codedocumentation2.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(codedocumentation0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(codedocumentation1, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(codedocumentation2, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const codedocumentation0_changes = (dirty & /*alertCode, alert*/ 1)
    			? get_spread_update(codedocumentation0_spread_levels, [
    					dirty & /*alertCode*/ 0 && get_spread_object(alertCode),
    					{ run: /*func*/ ctx[1] }
    				])
    			: {};

    			codedocumentation0.$set(codedocumentation0_changes);

    			const codedocumentation1_changes = (dirty & /*confirmCode, alert*/ 1)
    			? get_spread_update(codedocumentation1_spread_levels, [
    					dirty & /*confirmCode*/ 0 && get_spread_object(confirmCode),
    					{ run: /*func_1*/ ctx[2] }
    				])
    			: {};

    			codedocumentation1.$set(codedocumentation1_changes);

    			const codedocumentation2_changes = (dirty & /*promptCode, alert*/ 1)
    			? get_spread_update(codedocumentation2_spread_levels, [
    					dirty & /*promptCode*/ 0 && get_spread_object(promptCode),
    					{ run: /*func_2*/ ctx[3] }
    				])
    			: {};

    			codedocumentation2.$set(codedocumentation2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(codedocumentation0.$$.fragment, local);
    			transition_in(codedocumentation1.$$.fragment, local);
    			transition_in(codedocumentation2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(codedocumentation0.$$.fragment, local);
    			transition_out(codedocumentation1.$$.fragment, local);
    			transition_out(codedocumentation2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(codedocumentation0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(codedocumentation1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(codedocumentation2, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Alert', slots, []);

    	const alert = args => {
    		mt(args);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Alert> was created with unknown prop '${key}'`);
    	});

    	const func = () => alert(alertCode.args);
    	const func_1 = () => alert(confirmCode.args);
    	const func_2 = () => alert(promptCode.args);

    	$$self.$capture_state = () => ({
    		useAlert: mt,
    		alertCode,
    		confirmCode,
    		promptCode,
    		CodeDocumentation,
    		alert
    	});

    	return [alert, func, func_1, func_2];
    }

    class Alert extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Alert",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\pages\Toast.svelte generated by Svelte v3.47.0 */

    function create_fragment$2(ctx) {
    	let codedocumentation;
    	let current;
    	const codedocumentation_spread_levels = [toastCode, { run: /*toast*/ ctx[0] }];
    	let codedocumentation_props = {};

    	for (let i = 0; i < codedocumentation_spread_levels.length; i += 1) {
    		codedocumentation_props = assign(codedocumentation_props, codedocumentation_spread_levels[i]);
    	}

    	codedocumentation = new CodeDocumentation({
    			props: codedocumentation_props,
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(codedocumentation.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(codedocumentation, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const codedocumentation_changes = (dirty & /*toastCode, toast*/ 1)
    			? get_spread_update(codedocumentation_spread_levels, [
    					dirty & /*toastCode*/ 0 && get_spread_object(toastCode),
    					dirty & /*toast*/ 1 && { run: /*toast*/ ctx[0] }
    				])
    			: {};

    			codedocumentation.$set(codedocumentation_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(codedocumentation.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(codedocumentation.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(codedocumentation, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Toast', slots, []);

    	const toast = () => {
    		_t({ type: 'success' })('Message');
    		_t({ type: 'info' })('Message');
    		_t({ type: 'warning' })('Message');
    		_t({ type: 'danger' })('Message');
    		_t({ type: 'dark' })('Message');
    		_t({ type: 'light' })('Message');
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Toast> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		useToast: _t,
    		toastCode,
    		CodeDocumentation,
    		toast
    	});

    	return [toast];
    }

    class Toast extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toast",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\Content.svelte generated by Svelte v3.47.0 */
    const file$1 = "src\\Content.svelte";

    // (19:28) 
    function create_if_block_2(ctx) {
    	let toast;
    	let current;
    	toast = new Toast({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(toast.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(toast, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(toast.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(toast.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(toast, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(19:28) ",
    		ctx
    	});

    	return block;
    }

    // (17:29) 
    function create_if_block_1(ctx) {
    	let alert;
    	let current;
    	alert = new Alert({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(alert.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(alert, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(alert.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(alert.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(alert, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(17:29) ",
    		ctx
    	});

    	return block;
    }

    // (15:1) {#if page === 'Get Started'}
    function create_if_block(ctx) {
    	let getstarted;
    	let current;
    	getstarted = new GetStarted({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(getstarted.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(getstarted, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(getstarted.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(getstarted.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(getstarted, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(15:1) {#if page === 'Get Started'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let section;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*page*/ ctx[0] === 'Get Started') return 0;
    		if (/*page*/ ctx[0] === 'Alerts') return 1;
    		if (/*page*/ ctx[0] === 'Toast') return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			if (if_block) if_block.c();
    			attr_dev(section, "class", "content svelte-1mcnt9");
    			add_location(section, file$1, 12, 0, 195);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(section, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Content', slots, []);
    	let { page = '' } = $$props;
    	const writable_props = ['page'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Content> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    	};

    	$$self.$capture_state = () => ({ GetStarted, Alert, Toast, page });

    	$$self.$inject_state = $$props => {
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [page];
    }

    class Content extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { page: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Content",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get page() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set page(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.47.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let header;
    	let t0;
    	let pages;
    	let updating_page;
    	let t1;
    	let content;
    	let updating_page_1;
    	let current;
    	header = new Header({ $$inline: true });

    	function pages_page_binding(value) {
    		/*pages_page_binding*/ ctx[2](value);
    	}

    	let pages_props = { tabs: /*tabs*/ ctx[1] };

    	if (/*page*/ ctx[0] !== void 0) {
    		pages_props.page = /*page*/ ctx[0];
    	}

    	pages = new Pages({ props: pages_props, $$inline: true });
    	binding_callbacks.push(() => bind(pages, 'page', pages_page_binding));

    	function content_page_binding(value) {
    		/*content_page_binding*/ ctx[3](value);
    	}

    	let content_props = {};

    	if (/*page*/ ctx[0] !== void 0) {
    		content_props.page = /*page*/ ctx[0];
    	}

    	content = new Content({ props: content_props, $$inline: true });
    	binding_callbacks.push(() => bind(content, 'page', content_page_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(pages.$$.fragment);
    			t1 = space();
    			create_component(content.$$.fragment);
    			attr_dev(main, "class", "svelte-atddsv");
    			add_location(main, file, 12, 0, 215);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(header, main, null);
    			append_dev(main, t0);
    			mount_component(pages, main, null);
    			append_dev(main, t1);
    			mount_component(content, main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const pages_changes = {};

    			if (!updating_page && dirty & /*page*/ 1) {
    				updating_page = true;
    				pages_changes.page = /*page*/ ctx[0];
    				add_flush_callback(() => updating_page = false);
    			}

    			pages.$set(pages_changes);
    			const content_changes = {};

    			if (!updating_page_1 && dirty & /*page*/ 1) {
    				updating_page_1 = true;
    				content_changes.page = /*page*/ ctx[0];
    				add_flush_callback(() => updating_page_1 = false);
    			}

    			content.$set(content_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(pages.$$.fragment, local);
    			transition_in(content.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(pages.$$.fragment, local);
    			transition_out(content.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(header);
    			destroy_component(pages);
    			destroy_component(content);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let page = 'Get Started';
    	const tabs = ['Get Started', 'Alerts', 'Toast'];
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function pages_page_binding(value) {
    		page = value;
    		$$invalidate(0, page);
    	}

    	function content_page_binding(value) {
    		page = value;
    		$$invalidate(0, page);
    	}

    	$$self.$capture_state = () => ({ Header, Pages, Content, page, tabs });

    	$$self.$inject_state = $$props => {
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [page, tabs, pages_page_binding, content_page_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
