declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        externalAuthId: string;
        email: string;
        userId: string;
        workspaceId: string;
        workspaceRole: 'OWNER' | 'ADMIN' | 'MEMBER';
      };
    }
  }
}

export {};
