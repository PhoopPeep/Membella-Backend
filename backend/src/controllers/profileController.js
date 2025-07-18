const { getPrismaClient } = require('../config/database');
const { supabase } = require('../config/supabase');
const storageService = require('../utils/supabaseStorage');
const { asyncHandler } = require('../utils/errorHandler');

const prisma = getPrismaClient();

class ProfileController {
  getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
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
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  });

  updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { org_name, email, description, contact_info } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!existingUser) {
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

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  });

  changePassword = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

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
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      // First verify current password with Supabase
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Update password in Supabase
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (updateError) {
        return res.status(400).json({ message: 'Failed to update password' });
      }

      // Update timestamp in our database
      await prisma.owner.update({
        where: { owner_id: userId },
        data: { update_at: new Date() }
      });

      res.json({ message: 'Password changed successfully' });
    } catch (supabaseError) {
      console.error('Supabase password change error:', supabaseError);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  uploadAvatar = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Check if user exists
    const user = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Delete old profile image if exists
    if (user.logo) {
      try {
        const oldFilePath = storageService.extractPathFromUrl(user.logo);
        if (oldFilePath) {
          await storageService.deleteProfileImage(oldFilePath);
        }
      } catch (deleteError) {
        console.warn('Failed to delete old profile image:', deleteError.message);
      }
    }

    // Upload new image to Supabase Storage
    const uploadResult = await storageService.uploadProfileImage(
      req.file.buffer,
      userId,
      req.file.originalname,
      req.file.mimetype
    );

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

    res.json({
      message: 'Profile image uploaded successfully',
      user: updatedUser
    });
  });

  removeAvatar = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Check if user exists
    const user = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete image from Supabase Storage if exists
    if (user.logo) {
      try {
        const filePath = storageService.extractPathFromUrl(user.logo);
        if (filePath) {
          await storageService.deleteProfileImage(filePath);
        }
      } catch (deleteError) {
        console.warn('Failed to delete profile image from storage:', deleteError.message);
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

    res.json({
      message: 'Profile image removed successfully',
      user: updatedUser
    });
  });
}

module.exports = ProfileController;