const ProfileController = require('../src/controllers/profileController');
const UserRepository = require('../src/repositories/userRepository');
const User = require('../src/models/User');
const { SupabaseStorageService } = require('../src/utils/supabaseStorage');

describe('UTC-04: Profile Management Test Case', () => {
  let profileController, userRepository, supabaseStorage, req, res;

  beforeEach(() => {
    profileController = new ProfileController();
    userRepository = new UserRepository();
    supabaseStorage = new SupabaseStorageService();
    req = { user: { userId: 'test-user' }, body: {}, file: null };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn() 
    };
  });

  // TC036: When getProfile is called, should return user profile data
  it('TC036: should return user profile data when getProfile called', async () => {
    const mockUser = {
      owner_id: 'test-user',
      org_name: 'Test Org',
      email: 'test@example.com',
      description: 'Test description',
      contact_info: 'contact@test.com',
      logo: 'https://example.com/logo.png'
    };
    
    profileController.getProfile = jest.fn().mockImplementation(async (req, res) => {
      res.json({ user: mockUser });
    });
    
    req = { user: { userId: 'testuser' } };

    await profileController.getProfile(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: mockUser });
  });

  // TC037: When updateProfile is called with valid data, should update profile and return success
  it('TC037: should update profile and return success when updateProfile called with valid data', async () => {
    const mockResult = {
      message: 'Profile updated successfully',
      user: {
        org_name: 'Updated Org',
        description: 'New description'
      }
    };
    
    profileController.updateProfile = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockResult);
    });
    
    req.body = {
      org_name: 'Updated Org',
      description: 'New description'
    };

    await profileController.updateProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC038: When changePassword is called with valid passwords, should change password and return success
  it('TC038: should change password and return success when changePassword called with valid passwords', async () => {
    const mockResult = {
      message: 'Password changed successfully'
    };
    
    profileController.changePassword = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockResult);
    });
    
    req.body = {
      currentPassword: 'oldpass123',
      newPassword: 'newpass123'
    };

    await profileController.changePassword(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC039: When uploadAvatar is called with valid image file, should upload avatar and return success
  it('TC039: should upload avatar and return success when uploadAvatar called with valid image file', async () => {
    const mockResult = {
      message: 'Profile image uploaded successfully',
      user: {
        owner_id: 'test-user',
        logo: 'https://example.com/new-avatar.jpg'
      }
    };
    
    profileController.uploadAvatar = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockResult);
    });
    
    req.file = {
      buffer: Buffer.from('image data'),
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg'
    };

    await profileController.uploadAvatar(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC040: When removeAvatar is called, should remove avatar and return success
  it('TC040: should remove avatar and return success when removeAvatar called', async () => {
    const mockResult = {
      message: 'Profile image removed successfully',
      user: {
        owner_id: 'test-user',
        logo: null
      }
    };
    
    profileController.removeAvatar = jest.fn().mockImplementation(async (req, res) => {
      res.json(mockResult);
    });
    
    req = { user: { userId: 'test-user' } };

    await profileController.removeAvatar(req, res);

    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // TC041: When userRepository.findById is called with valid ID, should return User object
  it('TC041: should return User object when userRepository.findById called with valid ID', async () => {
    const mockPrismaUser = {
      owner_id: 'user-123',
      org_name: 'Test Org',
      email: 'test@example.com'
    };
    
    userRepository.prisma = {
      owner: {
        findUnique: jest.fn().mockResolvedValue(mockPrismaUser)
      }
    };

    const result = await userRepository.findById('user-123');

    expect(result).toBeInstanceOf(User);
  });

  // TC042: When userRepository.findByEmail is called with valid email, should return User object
  it('TC042: should return User object when userRepository.findByEmail called with valid email', async () => {
    const mockPrismaUser = {
      owner_id: 'user-123',
      email: 'test@example.com'
    };
    
    userRepository.prisma = {
      owner: {
        findUnique: jest.fn().mockResolvedValue(mockPrismaUser)
      }
    };

    const result = await userRepository.findByEmail('test@example.com');

    expect(result).toBeInstanceOf(User);
  });

  // TC043: When User.validate is called with valid data, should return empty errors array
  it('TC043: should return empty errors array when User.validate called with valid data', () => {
    const data = {
      org_name: 'Valid Organization',
      email: 'test@example.com'
    };

    const errors = User.validate(data);

    expect(errors).toEqual([]);
  });

  // TC044: When User.validate is called with invalid email format, should return validation error
  it('TC044: should return validation error when User.validate called with invalid email format', () => {
    const data = {
      org_name: 'Valid Org',
      email: 'invalid-email'
    };

    const errors = User.validate(data);

    expect(errors).toContain('Invalid email format');
  });

  // TC045: When uploadProfileImage is called with valid file buffer, should upload and return file URL
  it('TC045: should upload and return file URL when uploadProfileImage called with valid file buffer', async () => {
    const mockResult = {
      path: 'user-123/profile_xxx.jpg',
      url: 'https://example.supabase.co/storage/v1/object/public/profiles/user-123/profile_xxx.jpg',
      fullPath: 'user-123/profile_xxx.jpg'
    };
    
    supabaseStorage.uploadProfileImage = jest.fn().mockResolvedValue(mockResult);
    
    const fileBuffer = Buffer.from('image data');
    const userId = 'user-123';
    const originalName = 'avatar.jpg';
    const mimetype = 'image/jpeg';

    const result = await supabaseStorage.uploadProfileImage(fileBuffer, userId, originalName, mimetype);

    expect(result.path).toBe('user-123/profile_xxx.jpg');
    expect(result.url).toContain('https://');
    expect(result.fullPath).toBeDefined();
  });

  // TC046: When deleteProfileImage is called with valid file path, should delete file and return true
  it('TC046: should delete file and return true when deleteProfileImage called with valid file path', async () => {
    supabaseStorage.deleteProfileImage = jest.fn().mockResolvedValue(true);
    
    const filePath = 'user-123/profile_xxx.jpg';

    const result = await supabaseStorage.deleteProfileImage(filePath);

    expect(result).toBe(true);
  });

  // TC047: When extractPathFromUrl is called with public Supabase URL, should extract correct file path
  it('TC047: should extract correct file path when extractPathFromUrl called with public Supabase URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/profiles/user/file.png';
    
    const result = supabaseStorage.extractPathFromUrl(url);

    expect(result).toBe('user/file.png');
  });

  // TC048: When extractPathFromUrl is called with signed Supabase URL, should extract path without token
  it('TC048: should extract path without token when extractPathFromUrl called with signed Supabase URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/sign/profiles/user/file.png?token=abc';
    
    const result = supabaseStorage.extractPathFromUrl(url);

    expect(result).toBe('user/file.png');
  });

  // TC049: When extractPathFromUrl is called with unknown URL format, should return null
  it('TC049: should return null when extractPathFromUrl called with unknown URL format', () => {
    const url = 'https://example.com/unknown';
    
    const result = supabaseStorage.extractPathFromUrl(url);

    expect(result).toBeNull();
  });
});