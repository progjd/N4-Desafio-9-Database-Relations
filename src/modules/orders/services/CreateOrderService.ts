import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';

import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('could not find any customer with the give id');
    }

    const productExistent = await this.productsRepository.findAllById(products);

    if (!productExistent.length) {
      throw new AppError('could not find any product with the give id');
    }

    const productExistentId = productExistent.map(product => product.id);

    const checkProductInexistent = products.filter(
      product => !productExistentId.includes(product.id),
    );
    if (checkProductInexistent.length) {
      throw new AppError(
        `Could not find product${checkProductInexistent[0].id}`,
      );
    }
    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        productExistent.filter(pe => pe.id === product.id)[0].quantity <
        product.quantity,
    );
    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantityAvailable[0].quantity}  is not available for ${findProductsWithNoQuantityAvailable[0].id}`,
      );
    }
    const serializeProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productExistent.filter(pe => pe.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializeProducts,
    });
    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productExistent.filter(pe => pe.id === product.product_id)[0].quantity -
        product.quantity,
    }));
    await this.productsRepository.updateQuantity(orderedProductsQuantity);
    return order;
  }
}

export default CreateOrderService;
