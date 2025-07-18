class User {
  constructor(data) {
    this.owner_id = data.owner_id;
    this.org_name = data.org_name;
    this.email = data.email;
    this.description = data.description;
    this.contact_info = data.contact_info;
    this.logo = data.logo;
    this.create_at = data.create_at;
    this.update_at = data.update_at;
  }

  static fromPrisma(prismaUser) {
    return new User(prismaUser);
  }

  toJSON() {
    return {
      owner_id: this.owner_id,
      org_name: this.org_name,
      email: this.email,
      description: this.description,
      contact_info: this.contact_info,
      logo: this.logo,
      create_at: this.create_at,
      update_at: this.update_at
    };
  }

  static validate(data) {
    const errors = [];
    
    if (!data.org_name?.trim()) {
      errors.push('Organization name is required');
    }
    
    if (!data.email?.trim()) {
      errors.push('Email is required');
    }
    
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }
    
    return errors;
  }
}

module.exports = User;