import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
  });

  it('responds with the exception status and body for HttpExceptions', () => {
    const exception = new HttpException('not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('responds with 400 for a malformed JSON body SyntaxError', () => {
    const exception = Object.assign(new SyntaxError('bad json'), {
      status: 400,
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'El cuerpo de la solicitud no es JSON válido',
    });
  });

  it('responds with 500 for any other unexpected error', () => {
    filter.catch(new Error('boom'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Error interno del servidor',
    });
  });

  it('does not treat a plain SyntaxError without status 400 as a bad JSON body', () => {
    filter.catch(new SyntaxError('other syntax issue'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});
