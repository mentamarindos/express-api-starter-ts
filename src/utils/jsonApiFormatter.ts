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

export const formatJsonApiResponse = (data: JsonApiData | JsonApiData[], included?: any[]) => {
  return {
    data,
    ...(included && { included }),
  };
};

export const formatJsonApiError = (
  status: string,
  title: string,
  detail?: string,
  source?: { pointer: string }
): { errors: JsonApiError[] } => {
  return {
    errors: [
      {
        status,
        title,
        ...(detail && { detail }),
        ...(source && { source }),
      },
    ],
  };
};