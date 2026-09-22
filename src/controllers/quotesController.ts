import { Request, Response } from 'express';
import { eq, and, sql, desc, asc, type SQL } from 'drizzle-orm';
import { db, quotes, quoteRequests, users, notifications, UserRole } from '../db/schema';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';

export const createQuote = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (req.user.role !== UserRole.MANUFACTURER) {
      throw new AppError('Only manufacturers can create quotes', 403);
    }

    const { quoteRequestId, price, deliveryTimeInDays, validUntil, additionalNotes } = req.body.data.attributes;

    // Validate required fields
    if (!quoteRequestId || !price || !deliveryTimeInDays || !validUntil) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if the quote request exists and is open for quotes
    const quoteRequestResult = await db.select().from(quoteRequests)
      .where(eq(quoteRequests.id, quoteRequestId))
      .limit(1);
    
    if (quoteRequestResult.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const quoteRequest = quoteRequestResult[0];
    
    if (quoteRequest.status !== 'pending') {
      throw new AppError('Quote request is not open for quotes', 400);
    }

    // Check if the manufacturer has already submitted a quote for this request
    const existingQuote = await db.select()
      .from(quotes)
      .where(
        and(
          eq(quotes.quoteRequestId, quoteRequestId),
          eq(quotes.manufacturerId, req.user.id)
        )
      )
      .limit(1);
    
    if (existingQuote.length > 0) {
      throw new AppError('You have already submitted a quote for this request', 409);
    }

    // Create new quote
    const quoteId = generateUUID();
    const newQuote = {
      id: quoteId,
      quoteRequestId,
      manufacturerId: req.user.id,
      price,
      deliveryTimeInDays,
      validUntil,
      additionalNotes: additionalNotes || null,
      status: 'pending' as const, // Fix type safety for status
    };

    await db.insert(quotes).values(newQuote);

    // Update the quote request status to 'quoted'
    await db.update(quoteRequests)
      .set({ 
        status: 'quoted',
        updatedAt: new Date().toISOString()
      })
      .where(eq(quoteRequests.id, quoteRequestId));

    // Notify the customer
    await db.insert(notifications).values({
      id: generateUUID(),
      userId: quoteRequest.customerId,
      title: 'New Quote Received',
      message: `You have received a new quote for your request #${quoteRequestId.substring(0, 8)}.`,
      isRead: false,
      relatedEntityType: 'quote',
      relatedEntityId: quoteId,
    });

    // Get the created quote with related data
    const result = await db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .limit(1);

    const { quote, quoteRequest: updatedQuoteRequest, manufacturer } = result[0];
    if (!updatedQuoteRequest || !manufacturer) {
      throw new AppError('Related data not found', 500);
    }

    return res.status(201).json(
      formatJsonApiResponse(
        {
          type: 'quotes',
          id: quote.id,
          attributes: {
            price: quote.price,
            deliveryTimeInDays: quote.deliveryTimeInDays,
            validUntil: quote.validUntil,
            additionalNotes: quote.additionalNotes,
            status: quote.status,
            createdAt: quote.createdAt,
            updatedAt: quote.updatedAt,
          },
          relationships: {
            quoteRequest: {
              data: { type: 'quote-requests', id: quote.quoteRequestId }
            },
            manufacturer: {
              data: { type: 'users', id: quote.manufacturerId }
            }
          }
        },
        [
          {
            type: 'quote-requests',
            id: updatedQuoteRequest.id,
            attributes: {
              status: updatedQuoteRequest.status,
              width: updatedQuoteRequest.width,
              height: updatedQuoteRequest.height,
              quantity: updatedQuoteRequest.quantity,
            }
          },
          {
            type: 'users',
            id: manufacturer.id,
            attributes: {
              firstName: manufacturer.firstName,
              lastName: manufacturer.lastName,
              companyName: manufacturer.companyName,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create quote: ${(error as Error).message}`, 500);
  }
};

export const getQuotes = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Build the where conditions array
    const conditions: SQL[] = [];
    
    if (req.user.role === UserRole.MANUFACTURER) {
      conditions.push(eq(quotes.manufacturerId, req.user.id));
    } else if (req.user.role === UserRole.CUSTOMER) {
      conditions.push(eq(quoteRequests.customerId, req.user.id));
    }

    if (req.query.quote_request_id) {
      conditions.push(eq(quotes.quoteRequestId, req.query.quote_request_id as string));
    }

    if (req.query.status && ['pending', 'accepted', 'rejected'].includes(req.query.status as string)) {
      conditions.push(eq(quotes.status, req.query.status as 'pending' | 'accepted' | 'rejected'));
    }

    // Build the query
    const baseQuery = db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
      .from(quotes)
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .where(and(...conditions));

    // Fix sorting by using the quotes table columns directly
    type ValidSortFields = keyof typeof quotes | undefined;
    const sortField = req.query.sort_by as ValidSortFields || 'createdAt';

    let orderByClause: SQL;
    switch (sortField) {
      case 'createdAt':
        orderByClause = req.query.sort_direction === 'asc' ? asc(quotes.createdAt) : desc(quotes.createdAt);
        break;
      case 'updatedAt':
        orderByClause = req.query.sort_direction === 'asc' ? asc(quotes.updatedAt) : desc(quotes.updatedAt);
        break;
      case 'price':
        orderByClause = req.query.sort_direction === 'asc' ? asc(quotes.price) : desc(quotes.price);
        break;
      case 'deliveryTimeInDays':
        orderByClause = req.query.sort_direction === 'asc' ? asc(quotes.deliveryTimeInDays) : desc(quotes.deliveryTimeInDays);
        break;
      case 'validUntil':
        orderByClause = req.query.sort_direction === 'asc' ? asc(quotes.validUntil) : desc(quotes.validUntil);
        break;
      case 'status':
        orderByClause = req.query.sort_direction === 'asc' ? asc(quotes.status) : desc(quotes.status);
        break;
      default:
        orderByClause = desc(quotes.createdAt);
    }

    const query = baseQuery.orderBy(orderByClause);

    // Apply pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.page_size as string) || 10, 100);
    const offset = (page - 1) * pageSize;

    const results = await query.limit(pageSize).offset(offset);

    // Add null checks in getQuotes response formatting
    const formattedQuotes = results.map(({ quote, quoteRequest, manufacturer }) => {
      if (!quote || !quoteRequest || !manufacturer) {
        throw new AppError('Invalid data retrieved from database', 500);
      }

      return {
        type: 'quotes',
        id: quote.id,
        attributes: {
          price: quote.price,
          deliveryTimeInDays: quote.deliveryTimeInDays,
          validUntil: quote.validUntil,
          additionalNotes: quote.additionalNotes,
          status: quote.status,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
        },
        relationships: {
          quoteRequest: {
            data: { 
              type: 'quote-requests', 
              id: quoteRequest.id,
              attributes: {
                status: quoteRequest.status,
                width: quoteRequest.width,
                height: quoteRequest.height,
                quantity: quoteRequest.quantity,
              }
            }
          },
          manufacturer: {
            data: { 
              type: 'users', 
              id: manufacturer.id,
              attributes: {
                firstName: manufacturer.firstName,
                lastName: manufacturer.lastName,
                companyName: manufacturer.companyName,
              }
            }
          }
        }
      };
    });

    // Add null checks for included relationships
    const included = results.flatMap(({ quoteRequest, manufacturer }) => {
      if (!quoteRequest || !manufacturer) {
        throw new AppError('Invalid data retrieved from database', 500);
      }

      return [
        {
          type: 'quote-requests',
          id: quoteRequest.id,
          attributes: {
            status: quoteRequest.status,
            width: quoteRequest.width,
            height: quoteRequest.height,
            quantity: quoteRequest.quantity,
          }
        },
        {
          type: 'users',
          id: manufacturer.id,
          attributes: {
            firstName: manufacturer.firstName,
            lastName: manufacturer.lastName,
            companyName: manufacturer.companyName,
          }
        }
      ];
    });

    return res.json(formatJsonApiResponse(formattedQuotes, included));

  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get quotes: ${(error as Error).message}`, 500);
  }
};

export const getQuoteById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
      .from(quotes)
      .where(eq(quotes.id, id))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .limit(1);

    if (result.length === 0) {
      throw new AppError('Quote not found', 404);
    }

    const { quote, quoteRequest, manufacturer } = result[0];
    if (!quote || !quoteRequest || !manufacturer) {
      throw new AppError('Invalid data retrieved from database', 500);
    }

    // Check permissions
    if (req.user.role === UserRole.MANUFACTURER && quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    } else if (req.user.role === UserRole.CUSTOMER && quoteRequest.customerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    return res.json(
      formatJsonApiResponse(
        {
          type: 'quotes',
          id: quote.id,
          attributes: {
            price: quote.price,
            deliveryTimeInDays: quote.deliveryTimeInDays,
            validUntil: quote.validUntil,
            additionalNotes: quote.additionalNotes,
            status: quote.status,
            createdAt: quote.createdAt,
            updatedAt: quote.updatedAt,
          },
          relationships: {
            quoteRequest: {
              data: { type: 'quote-requests', id: quote.quoteRequestId }
            },
            manufacturer: {
              data: { type: 'users', id: quote.manufacturerId }
            }
          }
        },
        [
          {
            type: 'quote-requests',
            id: quoteRequest.id,
            attributes: {
              status: quoteRequest.status,
              width: quoteRequest.width,
              height: quoteRequest.height,
              quantity: quoteRequest.quantity,
            }
          },
          {
            type: 'users',
            id: manufacturer.id,
            attributes: {
              firstName: manufacturer.firstName,
              lastName: manufacturer.lastName,
              companyName: manufacturer.companyName,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get quote: ${(error as Error).message}`, 500);
  }
};

export const updateQuote = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const quoteResult = await db.select()
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (quoteResult.length === 0) {
      throw new AppError('Quote not found', 404);
    }

    const quote = quoteResult[0];

    // Check permissions
    if (req.user.role === UserRole.MANUFACTURER) {
      if (quote.manufacturerId !== req.user.id) {
        throw new AppError('Access denied', 403);
      }
      if (quote.status !== 'pending') {
        throw new AppError('Cannot update quote in its current status', 403);
      }
    } else if (req.user.role === UserRole.CUSTOMER) {
      const quoteRequest = await db.select()
        .from(quoteRequests)
        .where(eq(quoteRequests.id, quote.quoteRequestId))
        .limit(1);

      if (quoteRequest[0].customerId !== req.user.id) {
        throw new AppError('Access denied', 403);
      }

      // Customers can only accept or reject quotes
      if (!req.body.data.attributes.status) {
        throw new AppError('Only status updates are allowed', 400);
      }
      
      if (!['accepted', 'rejected'].includes(req.body.data.attributes.status)) {
        throw new AppError('Invalid status. Must be "accepted" or "rejected"', 400);
      }
    }

    const updates: any = {};

    // Manufacturers can update quote details
    if (req.user.role === UserRole.MANUFACTURER) {
      const { price, deliveryTimeInDays, validUntil, additionalNotes } = req.body.data.attributes;
      
      if (price !== undefined) updates.price = price;
      if (deliveryTimeInDays !== undefined) updates.deliveryTimeInDays = deliveryTimeInDays;
      if (validUntil !== undefined) updates.validUntil = validUntil;
      if (additionalNotes !== undefined) updates.additionalNotes = additionalNotes;
    }

    // Status updates
    if (req.body.data.attributes.status) {
      updates.status = req.body.data.attributes.status;
      
      // If customer accepts the quote, update quote request status
      if (req.user.role === UserRole.CUSTOMER && updates.status === 'accepted') {
        await db.update(quoteRequests)
          .set({ 
            status: 'accepted',
            updatedAt: new Date().toISOString()
          })
          .where(eq(quoteRequests.id, quote.quoteRequestId));

        // Reject all other quotes for this request
        await db.update(quotes)
          .set({ 
            status: 'rejected',
            updatedAt: new Date().toISOString()
          })
          .where(
            and(
              eq(quotes.quoteRequestId, quote.quoteRequestId),
              sql`${quotes.id} != ${id}`
            )
          );
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updates.updatedAt = new Date().toISOString();

    await db.update(quotes)
      .set(updates)
      .where(eq(quotes.id, id));

    // Get updated quote with related data
    const result = await db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
      .from(quotes)
      .where(eq(quotes.id, id))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .limit(1);

    const { quote: updatedQuote, quoteRequest, manufacturer } = result[0];
    if (!updatedQuote || !quoteRequest || !manufacturer) {
      throw new AppError('Invalid data retrieved from database', 500);
    }

    return res.json(
      formatJsonApiResponse(
        {
          type: 'quotes',
          id: updatedQuote.id,
          attributes: {
            price: updatedQuote.price,
            deliveryTimeInDays: updatedQuote.deliveryTimeInDays,
            validUntil: updatedQuote.validUntil,
            additionalNotes: updatedQuote.additionalNotes,
            status: updatedQuote.status,
            createdAt: updatedQuote.createdAt,
            updatedAt: updatedQuote.updatedAt,
          },
          relationships: {
            quoteRequest: {
              data: { type: 'quote-requests', id: updatedQuote.quoteRequestId }
            },
            manufacturer: {
              data: { type: 'users', id: updatedQuote.manufacturerId }
            }
          }
        },
        [
          {
            type: 'quote-requests',
            id: quoteRequest.id,
            attributes: {
              status: quoteRequest.status,
              width: quoteRequest.width,
              height: quoteRequest.height,
              quantity: quoteRequest.quantity,
            }
          },
          {
            type: 'users',
            id: manufacturer.id,
            attributes: {
              firstName: manufacturer.firstName,
              lastName: manufacturer.lastName,
              companyName: manufacturer.companyName,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update quote: ${(error as Error).message}`, 500);
  }
};

export const deleteQuote = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const quoteResult = await db.select()
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);

    if (quoteResult.length === 0) {
      throw new AppError('Quote not found', 404);
    }

    const quote = quoteResult[0];

    // Only manufacturers can delete their pending quotes
    if (req.user.role !== UserRole.MANUFACTURER || quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    if (quote.status !== 'pending') {
      throw new AppError('Cannot delete quote in its current status', 403);
    }

    await db.delete(quotes).where(eq(quotes.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete quote: ${(error as Error).message}`, 500);
  }
};