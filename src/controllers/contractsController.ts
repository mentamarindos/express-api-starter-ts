import { Request, Response } from 'express';
import { eq, and, desc, asc, type SQL } from 'drizzle-orm';
import {
  contracts,
  quotes,
  quoteRequests,
  users,
  UserRole,
} from '../db/schema';
import { db } from '../config/database';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';

// Add contract status type
type ContractStatus = 'pending' | 'completed' | 'signed' | 'active';

export const createContract = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        errors: [{
          status: '401',
          title: 'Authentication required'
        }]
      });
    }

    // Move role check to the beginning before any database operations
    if (req.user.role !== UserRole.MANUFACTURER) {
      return res.status(403).json({
        errors: [{
          status: '403',
          title: 'Only manufacturers can create contracts'
        }]
      });
    }

    const { quoteId, contractNumber, documentUrl } = req.body.data?.attributes || {};

    if (!quoteId || !contractNumber) {
      return res.status(400).json({
        errors: [{
          status: '400',
          title: 'Missing required fields'
        }]
      });
    }

    // Check if quote exists and is accepted
    const quoteResult = await db
      .select({
        quote: quotes,
        quoteRequest: quoteRequests,
      })
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .limit(1);

    if (quoteResult.length === 0) {
      return res.status(404).json({
        errors: [{
          status: '404',
          title: 'Quote not found'
        }]
      });
    }

    const { quote, quoteRequest } = quoteResult[0];

    if (quote.manufacturerId !== req.user.id) {
      return res.status(403).json({
        errors: [{
          status: '403',
          title: 'Access denied'
        }]
      });
    }

    if (quote.status !== 'accepted') {
      return res.status(400).json({
        errors: [{
          status: '400',
          title: 'Cannot create contract for non-accepted quote'
        }]
      });
    }

    // Check if contract number is unique
    const existingContract = await db
      .select()
      .from(contracts)
      .where(eq(contracts.contractNumber, contractNumber))
      .limit(1);

    if (existingContract.length > 0) {
      return res.status(409).json({
        errors: [{
          status: '409',
          title: 'Contract number already exists'
        }]
      });
    }

    // Create contract
    const contractId = generateUUID();
    const newContract = {
      id: contractId,
      quoteId,
      contractNumber,
      documentUrl: documentUrl || null,
      status: 'pending' as ContractStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.insert(contracts).values(newContract);

    // Update quote request status
    if (!quoteRequest) {
      return res.status(404).json({
        errors: [{
          status: '404',
          title: 'Quote request not found'
        }]
      });
    }

    await db
      .update(quoteRequests)
      .set({
        status: 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(quoteRequests.id, quoteRequest.id));

    // Get created contract with related data
    const result = await db
      .select({
        contract: contracts,
        quote: quotes,
        manufacturer: users,
        customer: {
          id: quoteRequests.customerId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .limit(1);

    const { contract, quote: updatedQuote, manufacturer, customer } = result[0];

    if (!updatedQuote || !manufacturer || !customer) {
      return res.status(404).json({
        errors: [{
          status: '404',
          title: 'Required related data not found'
        }]
      });
    }

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
              data: { type: 'quotes', id: contract.quoteId },
            },
          },
        },
        [
          {
            type: 'quotes',
            id: updatedQuote.id,
            attributes: {
              price: updatedQuote.price,
              deliveryTimeInDays: updatedQuote.deliveryTimeInDays,
              status: updatedQuote.status,
            },
          },
          {
            type: 'users',
            id: manufacturer.id,
            attributes: {
              firstName: manufacturer.firstName,
              lastName: manufacturer.lastName,
              companyName: manufacturer.companyName,
            },
          },
          {
            type: 'users',
            id: customer.id,
            attributes: {
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
            },
          },
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        errors: [{
          status: String(error.statusCode),
          title: error.message
        }]
      });
    }
    return res.status(500).json({
      errors: [{
        status: '500',
        title: `Failed to create contract: ${(error as Error).message}`
      }]
    });
  }
};

export const getContracts = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Create the base query with proper joins
    const baseQuery = db
      .select({
        contract: contracts,
        quote: quotes,
        quoteRequest: quoteRequests,
        manufacturer: users,
        customer: {
          id: quoteRequests.customerId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(contracts)
      .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
      .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .$dynamic();

    const conditions: SQL[] = [];

    // Filter based on user role
    if (req.user.role === UserRole.MANUFACTURER) {
      conditions.push(eq(quotes.manufacturerId, req.user.id));
    } else if (req.user.role === UserRole.CUSTOMER) {
      conditions.push(eq(quoteRequests.customerId, req.user.id));
    }

    // Support filtering by status
    if (req.query.status) {
      const status = req.query.status as ContractStatus;
      conditions.push(eq(contracts.status, status));
    }

    // Apply conditions if any exist
    let query = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 10;
    const offset = (page - 1) * pageSize;

    // Handle sorting
    const sortField = (req.query.sort as string) || '-createdAt';
    const sortDirection = sortField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = sortField.replace(/^[+-]/, '');

    // Add sorting
    switch (fieldName) {
      case 'createdAt':
        query = query.orderBy(sortDirection === 'desc' ? desc(contracts.createdAt) : asc(contracts.createdAt));
        break;
      case 'updatedAt':
        query = query.orderBy(sortDirection === 'desc' ? desc(contracts.updatedAt) : asc(contracts.updatedAt));
        break;
      case 'contractNumber':
        query = query.orderBy(sortDirection === 'desc' ? desc(contracts.contractNumber) : asc(contracts.contractNumber));
        break;
      case 'status':
        query = query.orderBy(sortDirection === 'desc' ? desc(contracts.status) : asc(contracts.status));
        break;
      default:
        query = query.orderBy(desc(contracts.createdAt));
    }

    // Apply pagination
    query = query.limit(pageSize).offset(offset);

    // Execute query
    const results = await query;

    // Map results to response format
    const formattedResults = results.map(({ contract, quote, manufacturer, customer }) => {
      if (!quote || !manufacturer || !customer) {
        throw new AppError('Required related data not found', 404);
      }

      return {
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
            data: { type: 'quotes', id: contract.quoteId },
          },
          manufacturer: {
            data: { type: 'users', id: manufacturer.id },
          },
          customer: {
            data: { type: 'users', id: customer.id },
          },
        },
      };
    });

    return res.json(formatJsonApiResponse(formattedResults));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to get contracts: ${(error as Error).message}`,
      500
    );
  }
};

export const getContractById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db
      .select({
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

    if (!quote || !quoteRequest || !manufacturer) {
      throw new AppError('Required related data not found', 404);
    }

    // Check permissions
    if (
      req.user.role === UserRole.MANUFACTURER &&
      quote.manufacturerId !== req.user.id
    ) {
      throw new AppError('Access denied', 403);
    } else if (
      req.user.role === UserRole.CUSTOMER &&
      quoteRequest.customerId !== req.user.id
    ) {
      throw new AppError('Access denied', 403);
    }

    return res.json(
      formatJsonApiResponse({
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
            data: { type: 'quotes', id: contract.quoteId },
          },
          manufacturer: {
            data: { type: 'users', id: manufacturer.id },
          },
        },
      })
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to get contract: ${(error as Error).message}`,
      500
    );
  }
};

export const updateContract = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const contractResult = await db
      .select({
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

    if (!quote || !quoteRequest) {
      throw new AppError('Required related data not found', 404);
    }

    // Check permissions
    if (
      req.user.role === UserRole.MANUFACTURER &&
      quote.manufacturerId !== req.user.id
    ) {
      throw new AppError('Access denied', 403);
    } else if (
      req.user.role === UserRole.CUSTOMER &&
      quoteRequest.customerId !== req.user.id
    ) {
      throw new AppError('Access denied', 403);
    }

    const updates: Partial<typeof contract> = {};
    const { documentUrl, signedDocumentUrl, signedAt, status } =
      req.body.data.attributes;

    // Manufacturers can update document URL
    if (req.user.role === UserRole.MANUFACTURER && documentUrl !== undefined) {
      updates.documentUrl = documentUrl;
    }

    // Customers can update signed document URL and signed date
    if (req.user.role === UserRole.CUSTOMER) {
      if (signedDocumentUrl !== undefined)
        updates.signedDocumentUrl = signedDocumentUrl;
      if (signedAt !== undefined) updates.signedAt = signedAt;

      // Customer signing the contract
      if (signedDocumentUrl && signedAt && contract.status === 'pending') {
        updates.status = 'signed' as ContractStatus;
      }
    }

    // Only admins can directly update status
    if (status && req.user.role === UserRole.ADMIN) {
      updates.status = status as ContractStatus;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updates.updatedAt = new Date().toISOString();

    await db.update(contracts).set(updates).where(eq(contracts.id, id));

    // Get updated contract
    const result = await db
      .select({
        contract: contracts,
        quote: quotes,
        manufacturer: users,
      })
      .from(contracts)
      .where(eq(contracts.id, id))
      .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
      .leftJoin(users, eq(quotes.manufacturerId, users.id))
      .limit(1);

    const {
      contract: updatedContract,
      quote: updatedQuote,
      manufacturer,
    } = result[0];

    if (!updatedQuote || !manufacturer) {
      throw new AppError('Required related data not found', 404);
    }

    return res.json(
      formatJsonApiResponse({
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
            data: { type: 'quotes', id: updatedContract.quoteId },
          },
          manufacturer: {
            data: { type: 'users', id: manufacturer.id },
          },
        },
      })
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to update contract: ${(error as Error).message}`,
      500
    );
  }
};

export const deleteContract = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        errors: [{
          status: '401',
          title: 'Authentication required'
        }]
      });
    }

    const { id } = req.params;

    const contractResult = await db
      .select({
        contract: contracts,
        quote: quotes,
      })
      .from(contracts)
      .where(eq(contracts.id, id))
      .leftJoin(quotes, eq(contracts.quoteId, quotes.id))
      .limit(1);

    if (contractResult.length === 0) {
      return res.status(404).json({
        errors: [{
          status: '404',
          title: 'Contract not found'
        }]
      });
    }

    const { contract, quote } = contractResult[0];

    if (!quote) {
      return res.status(404).json({
        errors: [{
          status: '404',
          title: 'Required related data not found'
        }]
      });
    }

    // Only manufacturers can delete their pending contracts
    if (
      req.user.role !== UserRole.MANUFACTURER ||
      quote.manufacturerId !== req.user.id
    ) {
      return res.status(403).json({
        errors: [{
          status: '403',
          title: 'Access denied'
        }]
      });
    }

    if (contract.status !== 'pending') {
      return res.status(403).json({
        errors: [{
          status: '403',
          title: 'Cannot delete contract in its current status'
        }]
      });
    }

    await db.delete(contracts).where(eq(contracts.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        errors: [{
          status: String(error.statusCode),
          title: error.message
        }]
      });
    }
    return res.status(500).json({
      errors: [{
        status: '500',
        title: `Failed to delete contract: ${(error as Error).message}`
      }]
    });
  }
};