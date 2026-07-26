import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('handles HttpException using its own status and response body', () => {
    const exception = new BadRequestException('bad input');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(exception.getStatus());
    expect(jsonMock).toHaveBeenCalledWith(exception.getResponse());
  });

  it('handles a JSON body-parser SyntaxError as 400', () => {
    const exception = Object.assign(new SyntaxError('Unexpected token'), { status: 400 });

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'El cuerpo de la solicitud no es JSON válido',
    });
  });

  it('handles a generic SyntaxError without a 400 status as an internal error', () => {
    const exception = new SyntaxError('other syntax error');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('handles unknown exceptions as internal server errors', () => {
    filter.catch(new Error('boom'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Error interno del servidor',
    });
  });
});
