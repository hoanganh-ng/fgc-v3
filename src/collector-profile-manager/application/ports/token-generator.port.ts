export interface TokenGenerator {
  generateToken(): Promise<string>;
}
