export declare class StorageService {
    private baseDir;
    private ensureDir;
    private safeExt;
    saveUserPhoto(params: {
        userId: string;
        file: Express.Multer.File;
    }): Promise<{
        publicUrl: string;
        fileName: string;
    }>;
}
