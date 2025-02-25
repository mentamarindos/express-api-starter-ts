import { Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, productionStatus, contracts, quotes, quoteRequests, users, UserRole } from '../db/schema';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';

export const createProductionStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (req.user.role !== UserRole.MANUFACTURER) {
      throw new AppError('Only manufacturers can create production status updates', 403);
    }

    const { contractId, status, notes } = req.body.data.attributes;

    if (!contractId || !status) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if contract exists and belongs to manufacturer
    const contractResult = await db.select({
      contract: contracts,
      quote: quotes,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .limit(1);

    if (contractResult.length === 0) {
      throw new AppError('Contract not found', 404);
    }

    const { contract, quote } = contractResult[0];

    if (quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    if (contract.status !== 'signed' && contract.status !== 'active') {
      throw new AppError('Cannot update production status for unsigned contract', 400);
    }

    // Create production status
    const productionStatusId = generateUUID();
    const newProductionStatus = {
      id: productionStatusId,
      contractId,
      status,
      notes: notes || null,
    };

    await db.insert(productionStatus).values(newProductionStatus);

    // Update contract status to active if it was just signed
    if (contract.status === 'signed') {
      await db.update(contracts)
        .set({ 
          status: 'active',
          updatedAt: new Date().toISOString()
        })
        .where(eq(contracts.id, contractId));
    }

    // Get created production status with related data
    const result = await db.select({
      status: productionStatus,
      contract: contracts,
      quote: quotes,
      manufacturer: users,
    })
    .from(productionStatus)
    .where(eq(productionStatus.id, productionStatusId))
    .leftJoin(contracts, eq(productionStatus.contractId, contracts.id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id))
    .limit(1);

    const { status: createdStatus, contract: updatedContract, quote: updatedQuote, manufacturer } = result[0];

    return res.status(201).json(
      formatJsonApiResponse(
        {
          type: 'production-status',
          id: createdStatus.id,
          attributes: {
            status: createdStatus.status,
            notes: createdStatus.notes,
            createdAt: createdStatus.createdAt,
            updatedAt: createdStatus.updatedAt,
          },
          relationships: {
            contract: {
              data: { type: 'contracts', id: createdStatus.contractId }
            }
          }
        },
        [
          {
            type: 'contracts',
            id: updatedContract.id,
            attributes: {
              contractNumber: updatedContract.contractNumber,
              status: updatedContract.status,
            }
          },
          {
            type: 'quotes',
            id: updatedQuote.id,
            attributes: {
              price: updatedQuote.price,
              deliveryTimeInDays: updatedQuote.deliveryTimeInDays,
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
    throw new AppError(`Failed to create production status: ${(error as Error).message}`, 500);
  }
};

export const getProductionStatuses = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    let query = db.select({
      status: productionStatus,
      contract: contracts,
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
    .from(productionStatus)
    .leftJoin(contracts, eq(productionStatus.contractId, contracts.id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id));

    // Filter based on user role
    if (req.user.role === UserRole.MANUFACTURER) {
      query = query.where(eq(quotes.manufacturerId, req.user.id));
    } else if (req.user.role === UserRole.CUSTOMER) {
      query = query.where(eq(quoteRequests.customerId, req.user.id));
    }

    // Support filtering by contract
    if (req.query.contract_id) {
      query = query.where(eq(productionStatus.contractId, req.query.contract_id as string));
    }

    // Support filtering by status
    if (req.query.status) {
      query = query.where(eq(productionStatus.status, req.query.status as string));
    }

    // Support sorting
    const sortField = (req.query.sort as string) || '-createdAt';
    const sortDirection = sortField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = sortField.replace(/^[+-]/, '');

    if (fieldName === 'createdAt') {
      query = query.orderBy(sortDirection === 'desc' ? 
        sql`${productionStatus.createdAt} DESC` : 
        sql`${productionStatus.createdAt} ASC`);
    }

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 10;
    const offset = (page - 1) * pageSize;

    query = query.limit(pageSize).offset(offset);

    const results = await query;

    return res.json(
      formatJsonApiResponse(
        results.map(({ status, contract, quote, manufacturer }) => ({
          type: 'production-status',
          id: status.id,
          attributes: {
            status: status.status,
            notes: status.notes,
            createdAt: status.createdAt,
            updatedAt: status.updatedAt,
          },
          relationships: {
            contract: {
              data: { type: 'contracts', id: status.contractId }
            }
          }
        })),
        results.flatMap(({ contract, quote, manufacturer }) => [
          {
            type: 'contracts',
            id: contract.id,
            attributes: {
              contractNumber: contract.contractNumber,
              status: contract.status,
            }
          },
          {
            type: 'quotes',
            id: quote.id,
            attributes: {
              price: quote.price,
              deliveryTimeInDays: quote.deliveryTimeInDays,
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
        ])
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get production statuses: ${(error as Error).message}`, 500);
  }
};

export const getProductionStatusById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db.select({
      status: productionStatus,
      contract: contracts,
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
    })
    .from(productionStatus)
    .where(eq(productionStatus.id, id))
    .leftJoin(contracts, eq(productionStatus.contractId, contracts.id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Production status not found', 404);
    }

    const { status, contract, quote, quoteRequest, manufacturer } = result[0];

    // Check permissions
    if (req.user.role === UserRole.MANUFACTURER && quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    } else if (req.user.role === UserRole.CUSTOMER && quoteRequest.customerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    return res.json(
      formatJsonApiResponse(
        {
          type: 'production-status',
          id: status.id,
          attributes: {
            status: status.status,
            notes: status.notes,
            createdAt: status.createdAt,
            updatedAt: status.updatedAt,
          },
          relationships: {
            contract: {
              data: { type: 'contracts', id: status.contractId }
            }
          }
        },
        [
          {
            type: 'contracts',
            id: contract.id,
            attributes: {
              contractNumber: contract.contractNumber,
              status: contract.status,
            }
          },
          {
            type: 'quotes',
            id: quote.id,
            attributes: {
              price: quote.price,
              deliveryTimeInDays: quote.deliveryTimeInDays,
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
    throw new AppError(`Failed to get production status: ${(error as Error).message}`, 500);
  }
};

export const updateProductionStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    // Get production status with related data
    const result = await db.select({
      status: productionStatus,
      contract: contracts,
      quote: quotes,
      quoteRequest: quoteRequests,
    })
    .from(productionStatus)
    .where(eq(productionStatus.id, id))
    .leftJoin(contracts, eq(productionStatus.contractId, contracts.id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Production status not found', 404);
    }

    const { status: currentStatus, contract, quote, quoteRequest } = result[0];

    // Check permissions
    if (req.user.role === UserRole.MANUFACTURER && quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    } else if (req.user.role !== UserRole.MANUFACTURER) {
      throw new AppError('Only manufacturers can update production status', 403);
    }

    const updates: any = {};
    const { status, notes } = req.body.data.attributes;

    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updates.updatedAt = new Date().toISOString();

    await db.update(productionStatus)
      .set(updates)
      .where(eq(productionStatus.id, id));

    // If status is completed, update contract status
    if (status === 'completed' && contract.status === 'active') {
      await db.update(contracts)
        .set({ 
          status: 'completed',
          updatedAt: new Date().toISOString()
        })
        .where(eq(contracts.id, contract.id));
    }

    // Get updated production status
    const updatedResult = await db.select({
      status: productionStatus,
      contract: contracts,
      quote: quotes,
      manufacturer: users,
    })
    .from(productionStatus)
    .where(eq(productionStatus.id, id))
    .leftJoin(contracts, eq(productionStatus.contractId, contracts.id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id))
    .limit(1);

    const { status: updatedStatus, contract: updatedContract, quote: updatedQuote, manufacturer } = updatedResult[0];

    return res.json(
      formatJsonApiResponse(
        {
          type: 'production-status',
          id: updatedStatus.id,
          attributes: {
            status: updatedStatus.status,
            notes: updatedStatus.notes,
            createdAt: updatedStatus.createdAt,
            updatedAt: updatedStatus.updatedAt,
          },
          relationships: {
            contract: {
              data: { type: 'contracts', id: updatedStatus.contractId }
            }
          }
        },
        [
          {
            type: 'contracts',
            id: updatedContract.id,
            attributes: {
              contractNumber: updatedContract.contractNumber,
              status: updatedContract.status,
            }
          },
          {
            type: 'quotes',
            id: updatedQuote.id,
            attributes: {
              price: updatedQuote.price,
              deliveryTimeInDays: updatedQuote.deliveryTimeInDays,
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
    throw new AppError(`Failed to update production status: ${(error as Error).message}`, 500);
  }
};

export const deleteProductionStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db.select({
      status: productionStatus,
      quote: quotes,
    })
    .from(productionStatus)
    .where(eq(productionStatus.id, id))
    .leftJoin(contracts, eq(productionStatus.contractId, contracts.id))
    .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Production status not found', 404);
    }

    const { quote } = result[0];

    // Only manufacturers can delete their production status updates
    if (req.user.role !== UserRole.MANUFACTURER || quote.manufacturerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    await db.delete(productionStatus).where(eq(productionStatus.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete production status: ${(error as Error).message}`, 500);
  }
};