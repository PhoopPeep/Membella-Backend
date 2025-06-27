const { PrismaClient } = require('../generated/prisma/client');
const { supabase } = require('./supabaseClient');

const prisma = new PrismaClient();

// Get user profile
async function getProfile(req, res) {
  try {
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
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

// Update user profile
async function updateProfile(req, res) {
  try {
    const userId = req.user.userId;
    const { org_name, email, description, contact_info, logo } = req.body;

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
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (contact_info !== undefined) updateData.contact_info = contact_info;
    if (logo !== undefined) updateData.logo = logo;

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

    // If email was updated, also update in Supabase
    if (email && email !== existingUser.email) {
      try {
        const { error: supabaseError } = await supabase.auth.admin.updateUserById(
          userId,
          { email: email.toLowerCase() }
        );

        if (supabaseError) {
          console.error('Supabase email update error:', supabaseError);
          // Don't fail the entire operation if Supabase update fails
        }
      } catch (supabaseError) {
        console.error('Supabase email update error:', supabaseError);
        // Don't fail the entire operation if Supabase update fails
      }
    }

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
        console.error('Supabase password update error:', updateError);
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
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
}

// Upload profile image/avatar
async function uploadAvatar(req, res) {
  try {
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

    // Convert file to base64
    const base64String = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Update user with new avatar
    const updatedUser = await prisma.owner.update({
      where: { owner_id: userId },
      data: {
        logo: base64String,
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
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Failed to upload profile image' });
  }
}

// Remove profile image/avatar
async function removeAvatar(req, res) {
  try {
    const userId = req.user.userId;

    // Check if user exists
    const user = await prisma.owner.findUnique({
      where: { owner_id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove avatar from user
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