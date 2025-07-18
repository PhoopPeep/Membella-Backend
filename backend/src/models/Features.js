class Feature {
  constructor(data) {
    this.feature_id = data.feature_id;
    this.name = data.name;
    this.description = data.description;
    this.owner_id = data.owner_id;
    this.create_at = data.create_at;
    this.update_at = data.update_at;
    this.delete_at = data.delete_at;
  }

  static fromPrisma(prismaFeature) {
    return new Feature(prismaFeature);
  }

  toJSON() {
    return {
      feature_id: this.feature_id,
      name: this.name,
      description: this.description,
      owner_id: this.owner_id,
      create_at: this.create_at,
      update_at: this.update_at,
      delete_at: this.delete_at
    };
  }

  static validate(data) {
    const errors = [];
    
    if (!data.name?.trim()) {
      errors.push('Feature name is required');
    }
    
    if (data.name?.trim().length < 2) {
      errors.push('Feature name must be at least 2 characters');
    }
    
    if (!data.description?.trim()) {
      errors.push('Feature description is required');
    }
    
    if (data.description?.trim().length < 10) {
      errors.push('Feature description must be at least 10 characters');
    }
    
    return errors;
  }
}

module.exports = Feature;