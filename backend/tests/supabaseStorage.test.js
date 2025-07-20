const { SupabaseStorageService } = require('../src/utils/supabaseStorage')
const { supabase } = require('../src/config/supabase')

// Test suite for SupabaseStorageService
describe('SupabaseStorageService', () => {
  let service;

  // Create a new instance before each test
  beforeEach(() => {
    service = new SupabaseStorageService();
    service.bucketName = 'profiles'; // Set the bucket name for consistency
  });

  // Test extracting the file path from a public Supabase Storage URL
  it('should extract path from public URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/profiles/user/file.png';
    const path = service.extractPathFromUrl(url);
    expect(path).toBe('user/file.png'); // Should return the path after the bucket
  });

  // Test extracting the file path from a signed Supabase Storage URL
  it('should extract path from signed URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/sign/profiles/user/file.png?token=abc';
    const path = service.extractPathFromUrl(url);
    expect(path).toBe('user/file.png'); // Should return the path before the token
  });

  // Test that an unknown or malformed URL returns null
  it('should return null for unknown URL', () => {
    const url = 'https://example.com/unknown';
    const path = service.extractPathFromUrl(url);
    expect(path).toBeNull(); // Should return null for non-Supabase URLs
  });
}); 