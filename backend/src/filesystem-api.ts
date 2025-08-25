import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
}

export class FileSystemAPI {
  async listFiles(dirPath: string): Promise<FileInfo[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.name.startsWith('.') && entry.name !== '.claude') {
          continue;
        }

        if (entry.isDirectory()) {
          files.push({
            name: entry.name,
            path: fullPath,
            type: 'directory'
          });
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime
          });
        }
      }

      return files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      logger.error(`Failed to list files in ${dirPath}:`, error);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error(`Failed to read file ${filePath}:`, error);
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`File written: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to write file ${filePath}:`, error);
      throw error;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(`Directory created: ${dirPath}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info(`File deleted: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
      const name = path.basename(filePath);
      
      return {
        name,
        path: filePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error(`Failed to get file info for ${filePath}:`, error);
      throw error;
    }
  }

  async searchFiles(
    dirPath: string,
    pattern: string,
    maxDepth: number = 5
  ): Promise<string[]> {
    const results: string[] = [];
    
    async function search(currentPath: string, depth: number): Promise<void> {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.name.includes(pattern)) {
            results.push(fullPath);
          }
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await search(fullPath, depth + 1);
          }
        }
      } catch (error) {
        logger.warn(`Failed to search in ${currentPath}:`, error);
      }
    }
    
    await search(dirPath, 0);
    return results;
  }
}