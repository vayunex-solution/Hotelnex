import logger from '../logger/logger.js';

class Container {
  constructor() {
    this.services = new Map(); // name -> { definition, type ('class', 'factory', 'instance'), lifetime ('singleton', 'transient'), dependencies, instance }
  }

  /**
   * Register a dependency in the container
   * 
   * @param {string} name 
   * @param {*} definition - class constructor, factory function, or direct instance
   * @param {object} options - { lifetime: 'singleton'|'transient', type: 'class'|'factory'|'instance', dependencies: [] }
   */
  register(name, definition, options = {}) {
    const lifetime = options.lifetime || 'singleton';
    const type = options.type || (typeof definition === 'function' ? (definition.prototype ? 'class' : 'factory') : 'instance');
    const dependencies = options.dependencies || [];

    this.services.set(name, {
      definition,
      type,
      lifetime,
      dependencies,
      instance: type === 'instance' ? definition : null
    });

    logger.debug(`[DIContainer] Registered: ${name} (Lifetime: ${lifetime}, Type: ${type})`);
  }

  /**
   * Resolves a dependency by name, recursively resolving its dependency graph
   * 
   * @param {string} name 
   * @returns {*}
   */
  resolve(name) {
    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`[DIContainer] Service not found: ${name}`);
    }

    // Return cached instance if singleton is already resolved
    if (registration.lifetime === 'singleton' && registration.instance) {
      return registration.instance;
    }

    // Resolve dependencies recursively
    const resolvedDependencies = registration.dependencies.map(depName => this.resolve(depName));

    let instance;
    if (registration.type === 'class') {
      instance = new registration.definition(...resolvedDependencies);
    } else if (registration.type === 'factory') {
      instance = registration.definition(...resolvedDependencies);
    } else {
      instance = registration.definition; // raw instance fallback
    }

    // Cache if singleton
    if (registration.lifetime === 'singleton') {
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * Resets the resolved instances (useful for clean testing)
   */
  resetSingletons() {
    for (const [name, reg] of this.services.entries()) {
      if (reg.type !== 'instance') {
        reg.instance = null;
      }
    }
  }
}

const container = new Container();
export default container;
