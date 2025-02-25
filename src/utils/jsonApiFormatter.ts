import { JsonApiResponse, JsonApiError } from '../types';

interface JsonApiData {
  type: string;
  id: string;
  attributes: Record<string, any>;
  relationships?: Record<string, { data: { type: string; id: string; } | { type: string; id: string; }[] }>;
}

interface JsonApiError {
  status: string;
  title: string;
  detail?: string;
  source?: { pointer: string };
}

export const formatJsonApiResponse = <T>(
  data: T,
  included?: any[],
  meta?: Record<string, any>
): JsonApiResponse<T> => {
  const response: JsonApiResponse<T> = { data };

  if (included && included.length > 0) {
    // Filter out duplicate included resources
    const uniqueIncluded = included.filter((item, index, self) =>
      index === self.findIndex(t => t.type === item.type && t.id === item.id)
    );
    response.included = uniqueIncluded;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};

export const formatJsonApiError = (
  status: string,
  title: string,
  detail?: string,
  code?: string,
  source?: { pointer?: string; parameter?: string }
): JsonApiError => {
  return {
    errors: [
      {
        status,
        title,
        ...(detail && { detail }),
        ...(code && { code }),
        ...(source && { source }),
      },
    ],
  };
};