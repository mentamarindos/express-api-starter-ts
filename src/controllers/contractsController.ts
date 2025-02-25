import { Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, contracts, quotes, quoteRequests, users, UserRole } from '../db/schema';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';

export const createContract = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (req.user.role !== UserRole.MANUFACTURER) {
      throw new AppError('Only manufacturers can create contracts', 403);
    }

    const { quoteId, contractNumber } = req.body.data.attributes;

    if (!quoteId || !contractNumber) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if quote exists and is accepted
    const quoteResult = await db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .limit(1);

    if (quoteResult.length === 0) {
      throw new AppError('Quote not found', 404);
    }

    const { quote, quoteRequest } = quoteResult[0];

    if (quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    if (quote.status !== 'accepted') {
      throw new AppError('Cannot create contract for non-accepted quote', 400);
    }

    // Check if contract number is unique
    const existingContract = await db.select()
      .from(contracts)
      .where(eq(contracts.contractNumber, contractNumber))
      .limit(1);

    if (existingContract.length > 0) {
      throw new AppError('Contract number already exists', 409);
    }

    // Create contract
    const contractId = generateUUID();
    const newContract = {
      id: contractId,
      quoteId,
      contractNumber,
      status: 'pending',
    };

    await db.insert(contracts).values(newContract);

    // Update quote request status
    await db.update(quoteRequests)
      .set({ 
        status: 'completed',
        updatedAt: new Date().toISOString()
      })
      .where(eq(quoteRequests.id, quoteRequest.id));

    // Get created contract with related data
    const result = await db.select({
      contract: contracts,
      quote: quotes,
      manufacturer: users,
      customer: {
        id: quoteRequests.customerId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id))
    .limit(1);

    const { contract, quote: updatedQuote, manufacturer, customer } = result[0];

    return res.status(201).json(
      formatJsonApiResponse(
        {
          type: 'contracts',
          id: contract.id,
          attributes: {
            contractNumber: contract.contractNumber,
            documentUrl: contract.documentUrl,
            signedDocumentUrl: contract.signedDocumentUrl,
            signedAt: contract.signedAt,
            status: contract.status,
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt,
          },
          relationships: {
            quote: {
              data: { type: 'quotes', id: contract.quoteId }
            }
          }
        },
        [
          {
            type: 'quotes',
            id: updatedQuote.id,
            attributes: {
              price: updatedQuote.price,
              deliveryTimeInDays: updatedQuote.deliveryTimeInDays,
              status: updatedQuote.status,
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
          },
          {
            type: 'users',
            id: customer.id,
            attributes: {
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to create contract: ${(error as Error).message}`, 500);
  }
};

export const getContracts = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    let query = db.select({
      contract: contracts,
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
    .from(contracts)
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id));

    // Filter based on user role
    if (req.user.role === UserRole.MANUFACTURER) {
      query = query.where(eq(quotes.manufacturerId, req.user.id));
    } else if (req.user.role === UserRole.CUSTOMER) {
      query = query.where(eq(quoteRequests.customerId, req.user.id));
    }

    // Support filtering by status
    if (req.query.status) {
      query = query.where(eq(contracts.status, req.query.status as string));
    }

    // Support sorting
    const sortField = (req.query.sort as string) || '-createdAt';
    const sortDirection = sortField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = sortField.replace(/^[+-]/, '');

    if (fieldName === 'createdAt') {
      query = query.orderBy(sortDirection === 'desc' ? 
        sql`${contracts.createdAt} DESC` : 
        sql`${contracts.createdAt} ASC`);
    }

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 10;
    const offset = (page - 1) * pageSize;

    const totalCount = await db.select({ count: sql`COUNT(*)` })
      .from(contracts)
      .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .where(
        and(
          req.user.role === UserRole.MANUFACTURER ? eq(quotes.manufacturerId, req.user.id) : undefined,
          req.user.role === UserRole.CUSTOMER ? eq(quoteRequests.customerId, req.user.id) : undefined,
          req.query.status ? eq(contracts.status, req.query.status as string) : undefined
        )
      );

    query = query.limit(pageSize).offset(offset);

    const results = await query;

    return res.json(
      formatJsonApiResponse(
        results.map(({ contract, quote, manufacturer }) => ({
          type: 'contracts',
          id: contract.id,
          attributes: {
            contractNumber: contract.contractNumber,
            documentUrl: contract.documentUrl,
            signedDocumentUrl: contract.signedDocumentUrl,
            signedAt: contract.signedAt,
            status: contract.status,
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt,
          },
          relationships: {
            quote: {
              data: { type: 'quotes', id: contract.quoteId }
            },
            manufacturer: {
              data: { type: 'users', id: manufacturer.id }
            }
          }
        }))
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get contracts: ${(error as Error).message}`, 500);
  }
};

export const getContractById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db.select({
      contract: contracts,
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
    .from(contracts)
    .where(eq(contracts.id, id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Contract not found', 404);
    }

    const { contract, quote, quoteRequest, manufacturer } = result[0];

    // Check permissions
    if (req.user.role === UserRole.MANUFACTURER && quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    } else if (req.user.role === UserRole.CUSTOMER && quoteRequest.customerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    return res.json(
      formatJsonApiResponse(
        {
          type: 'contracts',
          id: contract.id,
          attributes: {
            contractNumber: contract.contractNumber,
            documentUrl: contract.documentUrl,
            signedDocumentUrl: contract.signedDocumentUrl,
            signedAt: contract.signedAt,
            status: contract.status,
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt,
          },
          relationships: {
            quote: {
              data: { type: 'quotes', id: contract.quoteId }
            },
            manufacturer: {
              data: { type: 'users', id: manufacturer.id }
            }
          }
        }
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get contract: ${(error as Error).message}`, 500);
  }
};

export const updateContract = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const contractResult = await db.select({
      contract: contracts,
      quote: quotes,
      quoteRequest: quoteRequests,
    })
    .from(contracts)
    .where(eq(contracts.id, id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .limit(1);

    if (contractResult.length === 0) {
      throw new AppError('Contract not found', 404);
    }

    const { contract, quote, quoteRequest } = contractResult[0];

    // Check permissions
    if (req.user.role === UserRole.MANUFACTURER && quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    } else if (req.user.role === UserRole.CUSTOMER && quoteRequest.customerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    const updates: any = {};
    const { documentUrl, signedDocumentUrl, signedAt, status } = req.body.data.attributes;

    // Manufacturers can update document URL
    if (req.user.role === UserRole.MANUFACTURER && documentUrl !== undefined) {
      updates.documentUrl = documentUrl;
    }

    // Customers can update signed document URL and signed date
    if (req.user.role === UserRole.CUSTOMER) {
      if (signedDocumentUrl !== undefined) updates.signedDocumentUrl = signedDocumentUrl;
      if (signedAt !== undefined) updates.signedAt = signedAt;
      
      // Customer signing the contract
      if (signedDocumentUrl && signedAt && contract.status === 'pending') {
        updates.status = 'signed';
      }
    }

    // Only admins can directly update status
    if (status && req.user.role === UserRole.ADMIN) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updates.updatedAt = new Date().toISOString();

    await db.update(contracts)
      .set(updates)
      .where(eq(contracts.id, id));

    // Get updated contract
    const result = await db.select({
      contract: contracts,
      quote: quotes,
      manufacturer: users,
    })
    .from(contracts)
    .where(eq(contracts.id, id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id))
    .limit(1);

    const { contract: updatedContract, quote: updatedQuote, manufacturer } = result[0];

    return res.json(
      formatJsonApiResponse(
        {
          type: 'contracts',
          id: updatedContract.id,
          attributes: {
            contractNumber: updatedContract.contractNumber,
            documentUrl: updatedContract.documentUrl,
            signedDocumentUrl: updatedContract.signedDocumentUrl,
            signedAt: updatedContract.signedAt,
            status: updatedContract.status,
            createdAt: updatedContract.createdAt,
            updatedAt: updatedContract.updatedAt,
          },
          relationships: {
            quote: {
              data: { type: 'quotes', id: updatedContract.quoteId }
            },
            manufacturer: {
              data: { type: 'users', id: manufacturer.id }
            }
          }
        }
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update contract: ${(error as Error).message}`, 500);
  }
};

export const deleteContract = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const contractResult = await db.select({
      contract: contracts,
      quote: quotes,
    })
    .from(contracts)
    .where(eq(contracts.id, id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .limit(1);

    if (contractResult.length === 0) {
      throw new AppError('Contract not found', 404);
    }

    const { contract, quote } = contractResult[0];

    // Only manufacturers can delete their pending contracts
    if (req.user.role !== UserRole.MANUFACTURER || quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    if (contract.status !== 'pending') {
      throw new AppError('Cannot delete contract in its current status', 403);
    }

    await db.delete(contracts).where(eq(contracts.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete contract: ${(error as Error).message}`, 500);
  }
};