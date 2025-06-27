const { PrismaClient } = require('../generated/prisma/client');

const prisma = new PrismaClient();

// Get all members for the authenticated user
async function getMembers(req, res) {
  try {
    const ownerId = req.user.userId;

    const members = await prisma.member.findMany({
      where: {
        owner_id: ownerId,
        delete_at: null
      },
      include: {
        plan: {
          select: {
            plan_id: true,
            name: true
          }
        }
      },
      orderBy: {
        create_at: 'desc'
      }
    });

    // Transform the data
    const transformedMembers = members.map(member => ({
      id: member.member_id,
      email: member.email,
      planId: member.plan_id,
      planName: member.plan?.name || 'Unknown Plan',
      status: member.status,
      subscriptionStart: member.subscription_start,
      subscriptionEnd: member.subscription_end,
      createdAt: member.create_at
    }));

    res.json(transformedMembers);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
}

// Get a single member by ID
async function getMemberById(req, res) {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;
    
    const member = await prisma.member.findFirst({
      where: {
        member_id: id,
        owner_id: ownerId,
        delete_at: null
      },
      include: {
        plan: {
          select: {
            plan_id: true,
            name: true,
            price: true,
            duration: true
          }
        }
      }
    });

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Transform the data
    const transformedMember = {
      id: member.member_id,
      email: member.email,
      planId: member.plan_id,
      planName: member.plan?.name || 'Unknown Plan',
      planPrice: member.plan?.price ? parseFloat(member.plan.price.toString()) : 0,
      planDuration: member.plan?.duration || 0,
      status: member.status,
      subscriptionStart: member.subscription_start,
      subscriptionEnd: member.subscription_end,
      createdAt: member.create_at
    };

    res.json(transformedMember);
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ message: 'Failed to fetch member' });
  }
}

// Create a new member/subscriber
async function createMember(req, res) {
  try {
    const { email, planId, status = 'active', subscriptionEnd } = req.body;
    const ownerId = req.user.userId;

    if (!email || !planId) {
      return res.status(400).json({ message: 'Email and plan ID are required' });
    }

    // Verify the plan exists and belongs to the user
    const plan = await prisma.plan.findFirst({
      where: {
        plan_id: planId,
        owner_id: ownerId,
        delete_at: null
      }
    });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Check if member with this email already exists for this owner
    const existingMember = await prisma.member.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        owner_id: ownerId,
        delete_at: null
      }
    });

    if (existingMember) {
      return res.status(409).json({ message: 'Member with this email already exists' });
    }

    // Calculate subscription end date if not provided
    let calculatedSubscriptionEnd = subscriptionEnd;
    if (!calculatedSubscriptionEnd) {
      const startDate = new Date();
      calculatedSubscriptionEnd = new Date(startDate);
      calculatedSubscriptionEnd.setDate(startDate.getDate() + plan.duration);
    }

    const member = await prisma.member.create({
      data: {
        email: email.toLowerCase().trim(),
        plan_id: planId,
        owner_id: ownerId,
        status,
        subscription_end: calculatedSubscriptionEnd
      },
      include: {
        plan: {
          select: {
            plan_id: true,
            name: true
          }
        }
      }
    });

    // Transform the response
    const transformedMember = {
      id: member.member_id,
      email: member.email,
      planId: member.plan_id,
      planName: member.plan?.name || 'Unknown Plan',
      status: member.status,
      subscriptionStart: member.subscription_start,
      subscriptionEnd: member.subscription_end,
      createdAt: member.create_at
    };

    res.status(201).json({
      message: 'Member created successfully',
      member: transformedMember
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ message: 'Failed to create member' });
  }
}

// Update a member
async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const { email, planId, status, subscriptionEnd } = req.body;
    const ownerId = req.user.userId;

    // Check if member exists and belongs to user
    const existingMember = await prisma.member.findFirst({
      where: {
        member_id: id,
        owner_id: ownerId,
        delete_at: null
      }
    });

    if (!existingMember) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // If planId is being updated, verify the plan exists and belongs to the user
    if (planId && planId !== existingMember.plan_id) {
      const plan = await prisma.plan.findFirst({
        where: {
          plan_id: planId,
          owner_id: ownerId,
          delete_at: null
        }
      });

      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }
    }

    // If email is being updated, check for duplicates
    if (email && email.toLowerCase().trim() !== existingMember.email) {
      const duplicateMember = await prisma.member.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          owner_id: ownerId,
          member_id: { not: id },
          delete_at: null
        }
      });

      if (duplicateMember) {
        return res.status(409).json({ message: 'Member with this email already exists' });
      }
    }

    const updateData = {};
    if (email) updateData.email = email.toLowerCase().trim();
    if (planId) updateData.plan_id = planId;
    if (status) updateData.status = status;
    if (subscriptionEnd) updateData.subscription_end = new Date(subscriptionEnd);
    updateData.update_at = new Date();

    const member = await prisma.member.update({
      where: {
        member_id: id
      },
      data: updateData,
      include: {
        plan: {
          select: {
            plan_id: true,
            name: true
          }
        }
      }
    });

    // Transform the response
    const transformedMember = {
      id: member.member_id,
      email: member.email,
      planId: member.plan_id,
      planName: member.plan?.name || 'Unknown Plan',
      status: member.status,
      subscriptionStart: member.subscription_start,
      subscriptionEnd: member.subscription_end,
      createdAt: member.create_at
    };

    res.json({
      message: 'Member updated successfully',
      member: transformedMember
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ message: 'Failed to update member' });
  }
}

// Soft delete a member
async function deleteMember(req, res) {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;

    // Check if member exists and belongs to user
    const existingMember = await prisma.member.findFirst({
      where: {
        member_id: id,
        owner_id: ownerId,
        delete_at: null
      }
    });

    if (!existingMember) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Soft delete the member
    await prisma.member.update({
      where: {
        member_id: id
      },
      data: {
        delete_at: new Date()
      }
    });

    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Failed to delete member' });
  }
}

module.exports = {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember
};