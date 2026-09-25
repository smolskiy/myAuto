import { MyAutoDB } from './schema'

/** Единственный экземпляр базы приложения. Тесты создают свой `new MyAutoDB(имя)`. */
export const db = new MyAutoDB()
