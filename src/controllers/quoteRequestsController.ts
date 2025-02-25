import { Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, quoteRequests, users, products, materials, openingTypes, profileTypes, notifications, UserRole } from '../db/schema';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';

export const createQuoteRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (req.user.role !== UserRole.CUSTOMER) {
      throw new AppError('Only customers can create quote requests', 403);
    }

    const { productId, materialId, openingTypeId, profileTypeId, width, height, quantity, comments } = req.body.data.attributes;

    // Validate required fields
    if (!productId || !materialId || !openingTypeId || !profileTypeId || !width || !height) {
      throw new AppError('Missing required fields', 400);
    }

    // Verify that referenced entities exist
    const [product, material, openingType, profileType] = await Promise.all([
      db.select().from(products).where(eq(products.id, productId)).limit(1),
      db.select().from(materials).where(eq(materials.id, materialId)).limit(1),
      db.select().from(openingTypes).where(eq(openingTypes.id, openingTypeId)).limit(1),
      db.select().from(profileTypes).where(eq(profileTypes.id, profileTypeId)).limit(1),
    ]);

    if (product.length === 0) {
      throw new AppError('Product not found', 404);
    }
    if (material.length === 0) {
      throw new AppError('Material not found', 404);
    }
    if (openingType.length === 0) {
      throw new AppError('Opening type not found', 404);
    }
    if (profileType.length === 0) {
      throw new AppError('Profile type not found', 404);
    }

    // Create quote request
    const quoteRequestId = generateUUID();
    const newQuoteRequest = {
      id: quoteRequestId,
      customerId: req.user.id,
      productId,
      materialId,
      openingTypeId,
      profileTypeId,
      width,
      height,
      quantity: quantity || 1,
      comments: comments || null,
      status: 'pending',
    };

    await db.insert(quoteRequests).values(newQuoteRequest);

    // Notify manufacturers
    const manufacturers = await db.select().from(users)
      .where(and(
        eq(users.role, UserRole.MANUFACTURER),
        eq(users.isActive, true)
      ));

    if (manufacturers.length > 0) {
      const notificationsToInsert = manufacturers.map(manufacturer => ({
        id: generateUUID(),
        userId: manufacturer.id,
        title: 'New Quote Request',
        message: `A new quote request (#${quoteRequestId.substring(0, 8)}) has been submitted.`,
        isRead: false,
        relatedEntityType: 'quote_request',
        relatedEntityId: quoteRequestId,
      }));

      await db.insert(notifications).values(notificationsToInsert);
    }

    // Get the created quote request with related data
    const result = await db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
    })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, quoteRequestId))
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .limit(1);

    const { quoteRequest, product: productData, material: materialData, openingType: openingTypeData, profileType: profileTypeData } = result[0];

    return res.status(201).json(
      formatJsonApiResponse(
        {
          type: 'quote-requests',
          id: quoteRequest.id,
          attributes: {
            width: quoteRequest.width,
            height: quoteRequest.height,
            quantity: quoteRequest.quantity,
            comments: quoteRequest.comments,
            status: quoteRequest.status,
            createdAt: quoteRequest.createdAt,
            updatedAt: quoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: quoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: quoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: quoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: quoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: quoteRequest.profileTypeId }
            }
          }
        },
        [
          {
            type: 'products',
            id: productData.id,
            attributes: {
              name: productData.name,
              category: productData.category,
              description: productData.description,
            }
          },
          {
            type: 'materials',
            id: materialData.id,
            attributes: {
              name: materialData.name,
              description: materialData.description,
            }
          },
          {
            type: 'opening-types',
            id: openingTypeData.id,
            attributes: {
              name: openingTypeData.name,
              description: openingTypeData.description,
            }
          },
          {
            type: 'profile-types',
            id: profileTypeData.id,
            attributes: {
              name: profileTypeData.name,
              description: profileTypeData.description,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create quote request: ${(error as Error).message}`, 500);
  }
};

export const getQuoteRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    let query = db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
      customer: users,
    })
    .from(quoteRequests)
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .leftJoin(users, eq(quoteRequests.customerId, users.id));

    // Filter based on user role
    if (req.user.role === UserRole.CUSTOMER) {
      query = query.where(eq(quoteRequests.customerId, req.user.id));
    }

    // Support filtering by status
    if (req.query.status) {
      query = query.where(eq(quoteRequests.status, req.query.status as string));
    }

    // Support sorting
    const sortField = (req.query.sort as string) || '-createdAt';
    const sortDirection = sortField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = sortField.replace(/^[+-]/, '');

    if (fieldName === 'createdAt') {
      query = query.orderBy(sortDirection === 'desc' ? 
        sql`${quoteRequests.createdAt} DESC` : 
        sql`${quoteRequests.createdAt} ASC`);
    }

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 10;
    const offset = (page - 1) * pageSize;

    const totalCount = await db.select({ count: sql`COUNT(*)` })
      .from(quoteRequests)
      .where(req.user.role === UserRole.CUSTOMER ? eq(quoteRequests.customerId, req.user.id) : undefined);

    query = query.limit(pageSize).offset(offset);

    const results = await query;

    return res.json(
      formatJsonApiResponse(
        results.map(({ quoteRequest, product, material, openingType, profileType, customer }) => ({
          type: 'quote-requests',
          id: quoteRequest.id,
          attributes: {
            width: quoteRequest.width,
            height: quoteRequest.height,
            quantity: quoteRequest.quantity,
            comments: quoteRequest.comments,
            status: quoteRequest.status,
            createdAt: quoteRequest.createdAt,
            updatedAt: quoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: quoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: quoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: quoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: quoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: quoteRequest.profileTypeId }
            }
          }
        })),
        results.flatMap(({ product, material, openingType, profileType, customer }) => [
          {
            type: 'products',
            id: product.id,
            attributes: {
              name: product.name,
              category: product.category,
              description: product.description,
            }
          },
          {
            type: 'materials',
            id: material.id,
            attributes: {
              name: material.name,
              description: material.description,
            }
          },
          {
            type: 'opening-types',
            id: openingType.id,
            attributes: {
              name: openingType.name,
              description: openingType.description,
            }
          },
          {
            type: 'profile-types',
            id: profileType.id,
            attributes: {
              name: profileType.name,
              description: profileType.description,
            }
          },
          // Only include customer details for admins and manufacturers
          ...(req.user.role !== UserRole.CUSTOMER ? [
            {
              type: 'users',
              id: customer.id,
              attributes: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
              }
            }
          ] : [])
        ])
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get quote requests: ${(error as Error).message}`, 500);
  }
};

export const getQuoteRequestById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
      customer: users,
    })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .leftJoin(users, eq(quoteRequests.customerId, users.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const { quoteRequest, product, material, openingType, profileType, customer } = result[0];

    // Check permissions
    if (req.user.role === UserRole.CUSTOMER && quoteRequest.customerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    return res.json(
      formatJsonApiResponse(
        {
          type: 'quote-requests',
          id: quoteRequest.id,
          attributes: {
            width: quoteRequest.width,
            height: quoteRequest.height,
            quantity: quoteRequest.quantity,
            comments: quoteRequest.comments,
            status: quoteRequest.status,
            createdAt: quoteRequest.createdAt,
            updatedAt: quoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: quoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: quoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: quoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: quoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: quoteRequest.profileTypeId }
            }
          }
        },
        [
          {
            type: 'products',
            id: product.id,
            attributes: {
              name: product.name,
              category: product.category,
              description: product.description,
            }
          },
          {
            type: 'materials',
            id: material.id,
            attributes: {
              name: material.name,
              description: material.description,
            }
          },
          {
            type: 'opening-types',
            id: openingType.id,
            attributes: {
              name: openingType.name,
              description: openingType.description,
            }
          },
          {
            type: 'profile-types',
            id: profileType.id,
            attributes: {
              name: profileType.name,
              description: profileType.description,
            }
          },
          // Only include customer details for admins and manufacturers
          ...(req.user.role !== UserRole.CUSTOMER ? [
            {
              type: 'users',
              id: customer.id,
              attributes: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
              }
            }
          ] : [])
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get quote request: ${(error as Error).message}`, 500);
  }
};

export const updateQuoteRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    // Get the quote request
    const quoteRequestResult = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1);

    if (quoteRequestResult.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const quoteRequest = quoteRequestResult[0];

    // Check permissions
    if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only update their own quote requests and only if they're in 'pending' status
      if (quoteRequest.customerId !== req.user.id) {
        throw new AppError('Access denied', 403);
      }
      
      if (quoteRequest.status !== 'pending') {
        throw new AppError('Cannot update quote request in its current status', 403);
      }
    }

    const { productId, materialId, openingTypeId, profileTypeId, width, height, quantity, comments, status } = req.body.data.attributes;

    // Prepare update data
    const updateData: any = {};

    // Customers can update the specifications
    if (req.user.role === UserRole.CUSTOMER) {
      if (productId) {
        const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
        if (product.length === 0) {
          throw new AppError('Product not found', 404);
        }
        updateData.productId = productId;
      }

      if (materialId) {
        const material = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
        if (material.length === 0) {
          throw new AppError('Material not found', 404);
        }
        updateData.materialId = materialId;
      }

      if (openingTypeId) {
        const openingType = await db.select().from(openingTypes).where(eq(openingTypes.id, openingTypeId)).limit(1);
        if (openingType.length === 0) {
          throw new AppError('Opening type not found', 404);
        }
        updateData.openingTypeId = openingTypeId;
      }

      if (profileTypeId) {
        const profileType = await db.select().from(profileTypes).where(eq(profileTypes.id, profileTypeId)).limit(1);
        if (profileType.length === 0) {
          throw new AppError('Profile type not found', 404);
        }
        updateData.profileTypeId = profileTypeId;
      }

      if (width !== undefined) updateData.width = width;
      if (height !== undefined) updateData.height = height;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (comments !== undefined) updateData.comments = comments;
    }

    // Only admins can update status
    if (status && req.user.role === UserRole.ADMIN) {
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updateData.updatedAt = new Date().toISOString();

    // Update the quote request
    await db.update(quoteRequests).set(updateData).where(eq(quoteRequests.id, id));

    // Get the updated quote request with related data
    const result = await db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
    })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .limit(1);

    const { quoteRequest: updatedQuoteRequest, product, material, openingType, profileType } = result[0];

    return res.json(
      formatJsonApiResponse(
        {
          type: 'quote-requests',
          id: updatedQuoteRequest.id,
          attributes: {
            width: updatedQuoteRequest.width,
            height: updatedQuoteRequest.height,
            quantity: updatedQuoteRequest.quantity,
            comments: updatedQuoteRequest.comments,
            status: updatedQuoteRequest.status,
            createdAt: updatedQuoteRequest.createdAt,
            updatedAt: updatedQuoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: updatedQuoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: updatedQuoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: updatedQuoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: updatedQuoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: updatedQuoteRequest.profileTypeId }
            }
          }
        },
        [
          {
            type: 'products',
            id: product.id,
            attributes: {
              name: product.name,
              category: product.category,
              description: product.description,
            }
          },
          {
            type: 'materials',
            id: material.id,
            attributes: {
              name: material.name,
              description: material.description,
            }
          },
          {
            type: 'opening-types',
            id: openingType.id,
            attributes: {
              name: openingType.name,
              description: openingType.description,
            }
          },
          {
            type: 'profile-types',
            id: profileType.id,
            attributes: {
              name: profileType.name,
              description: profileType.description,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update quote request: ${(error as Error).message}`, 500);
  }
};

export const deleteQuoteRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    // Get the quote request
    const quoteRequestResult = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1);

    if (quoteRequestResult.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const quoteRequest = quoteRequestResult[0];

    if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only delete their own quote requests and only if they're in 'pending' status
      if (quoteRequest.customerId !== req.user.id) {
        throw new AppError('Access denied', 403);
      }
      
      if (quoteRequest.status !== 'pending') {
        throw new AppError('Cannot delete quote request in its current status', 403);
      }
    } else if (req.user.role !== UserRole.ADMIN) {
      // Only customers (for their own pending requests) and admins can delete
      throw new AppError('Access denied', 403);
    }

    await db.delete(quoteRequests).where(eq(quoteRequests.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete quote request: ${(error as Error).message}`, 500);
  }
};