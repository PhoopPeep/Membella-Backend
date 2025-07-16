const { PrismaClient } = require('../generated/prisma/client');
const { supabase } = require('./supabaseClient');
const storageService = require('./utils/supabaseStorage');

const prisma = new PrismaClient();

// Get user profile
async function getProfile(req, res) {
  try {
    const userId = req.user.userId;
    console.log('Getting profile for user:', userId);

    const user = await prisma.owner.findUnique({
      where: { owner_id: userId },
      select: {
        owner_id: true,
        org_name: true,
        email: true,
        description: true,
        contact_info: true,
        logo: true,
        create_at: true,
        update_at: true
      }
    });

    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Profile retrieved successfully for:', user.email);
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

// Update user profile
async function updateProfile(req, res) {
  try {
    const userId = req.user.userId;
    const { org_name, email, description, contact_info } = req.body;
    
    console.log('Updating profile for user:', userId);
    console.log('Update data:', { org_name, email, description, contact_info });

    // Check if user exists
    const existingUser = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!existingUser) {
      console.log('User not found for update:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // If email is being updated, check if it's already taken by another user
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.owner.findFirst({
        where: {
          email: email.toLowerCase(),
          owner_id: { not: userId }
        }
      });

      if (emailExists) {
        console.log('Email already taken:', email);
        return res.status(400).json({ message: 'Email is already taken by another user' });
      }
    }

    // Prepare update data
    const updateData = {
      update_at: new Date()
    };

    if (org_name !== undefined) updateData.org_name = org_name.trim();
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (contact_info !== undefined) updateData.contact_info = contact_info;

    console.log('Applying database update...');
    
    // Update user in database
    const updatedUser = await prisma.owner.update({
      where: { owner_id: userId },
      data: updateData,
      select: {
        owner_id: true,
        org_name: true,
        email: true,
        description: true,
        contact_info: true,
        logo: true,
        create_at: true,
        update_at: true
      }
    });

    console.log('Profile updated successfully for:', updatedUser.email);
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
}

// Change password
async function changePassword(req, res) {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    console.log('Changing password for user:', userId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Check if user exists
    const user = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!user) {
      console.log('User not found for password change:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      console.log('Verifying current password with Supabase...');
      
      // First verify current password with Supabase
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        console.log('Current password verification failed:', signInError.message);
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      console.log('Current password verified, updating to new password...');

      // Update password in Supabase
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Supabase password update error:', updateError);
        return res.status(400).json({ message: 'Failed to update password' });
      }

      // Update timestamp in our database
      await prisma.owner.update({
        where: { owner_id: userId },
        data: { update_at: new Date() }
      });

      console.log('Password changed successfully for:', user.email);
      res.json({ message: 'Password changed successfully' });
    } catch (supabaseError) {
      console.error('Supabase password change error:', supabaseError);
      res.status(500).json({ message: 'Failed to change password' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
}

// Upload profile image to Supabase Storage
async function uploadAvatar(req, res) {
  try {
    const userId = req.user.userId;

    console.log('Uploading avatar for user:', userId);

    // Check if user exists
    const user = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!user) {
      console.log('User not found for avatar upload:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Delete old profile image if exists
    if (user.logo) {
      try {
        // Extract file path from existing URL
        const oldFilePath = storageService.extractPathFromUrl(user.logo);
        if (oldFilePath) {
          console.log('Deleting old profile image:', oldFilePath);
          await storageService.deleteProfileImage(oldFilePath);
        }
      } catch (deleteError) {
        console.warn('Failed to delete old profile image:', deleteError.message);
        // Continue with upload even if delete fails
      }
    }

    // Upload new image to Supabase Storage
    const uploadResult = await storageService.uploadProfileImage(
      req.file.buffer,
      userId,
      req.file.originalname,
      req.file.mimetype
    );

    console.log('Upload successful:', uploadResult);

    // Update user with new avatar URL
    const updatedUser = await prisma.owner.update({
      where: { owner_id: userId },
      data: {
        logo: uploadResult.url,
        update_at: new Date()
      },
      select: {
        owner_id: true,
        org_name: true,
        email: true,
        description: true,
        contact_info: true,
        logo: true,
        create_at: true,
        update_at: true
      }
    });

    console.log('Avatar uploaded successfully for:', user.email);
    res.json({
      message: 'Profile image uploaded successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Handle specific storage errors
    if (error.message?.includes('Upload failed')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message?.includes('File too large')) {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB' });
    }
    if (error.message?.includes('Invalid file type')) {
      return res.status(400).json({ message: 'Invalid file type. Only images are allowed' });
    }
    
    res.status(500).json({ message: 'Failed to upload profile image' });
  }
}

// Remove profile image from Supabase Storage
async function removeAvatar(req, res) {
  try {
    const userId = req.user.userId;

    console.log('Removing avatar for user:', userId);

    // Check if user exists
    const user = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!user) {
      console.log('User not found for avatar removal:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete image from Supabase Storage if exists
    if (user.logo) {
      try {
        const filePath = storageService.extractPathFromUrl(user.logo);
        if (filePath) {
          console.log('Deleting profile image from storage:', filePath);
          await storageService.deleteProfileImage(filePath);
        }
      } catch (deleteError) {
        console.warn('Failed to delete profile image from storage:', deleteError.message);
        // Continue with database update even if storage delete fails
      }
    }

    // Remove avatar URL from database
    const updatedUser = await prisma.owner.update({
      where: { owner_id: userId },
      data: {
        logo: null,
        update_at: new Date()
      },
      select: {
        owner_id: true,
        org_name: true,
        email: true,
        description: true,
        contact_info: true,
        logo: true,
        create_at: true,
        update_at: true
      }
    });

    console.log('Avatar removed successfully for:', user.email);
    res.json({
      message: 'Profile image removed successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Remove avatar error:', error);
    res.status(500).json({ message: 'Failed to remove profile image' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  removeAvatar
};