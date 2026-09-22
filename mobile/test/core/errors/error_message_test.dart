import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/errors/error_message.dart';

void main() {
  for (final code in ['en', 'si', 'ta']) {
    final l10n = lookupAppLocalizations(Locale(code));

    group('errorMessage ($code)', () {
      ApiException api(int status, String errorCode) =>
          ApiException('raw text', statusCode: status, code: errorCode);

      test('maps every backend code to its own localized sentence', () {
        expect(
          errorMessage(l10n, api(409, 'ALREADY_APPLIED')),
          l10n.errorAlreadyApplied,
        );
        expect(
          errorMessage(l10n, api(409, 'PROFILE_INCOMPLETE')),
          l10n.errorProfileIncomplete,
        );
        expect(
          errorMessage(l10n, api(409, 'INVALID_STATE')),
          l10n.errorInvalidState,
        );
        expect(
          errorMessage(l10n, api(409, 'PROVIDER_PROFILE_REQUIRED')),
          l10n.errorProfileRequired,
        );
        expect(
          errorMessage(l10n, api(400, 'VALIDATION_ERROR')),
          l10n.errorValidation,
        );
        expect(
          errorMessage(l10n, api(429, 'RATE_LIMITED')),
          l10n.errorRateLimited,
        );
      });

      test('the codes give different sentences (no accidental collapse)', () {
        final messages = {
          for (final c in [
            'ALREADY_APPLIED',
            'PROFILE_INCOMPLETE',
            'INVALID_STATE',
            'PROVIDER_PROFILE_REQUIRED',
            'VALIDATION_ERROR',
          ])
            errorMessage(l10n, api(409, c)),
        };
        expect(messages, hasLength(5));
      });

      test('offline and timeouts read as a connection problem', () {
        expect(
          errorMessage(l10n, const NetworkException('x')),
          l10n.errorNetwork,
        );
        expect(
          errorMessage(l10n, const NetworkTimeoutException('x')),
          l10n.errorNetwork,
        );
      });

      test('a 404 says it may no longer be available', () {
        expect(
          errorMessage(l10n, const NotFoundException('x')),
          l10n.errorNotFound,
        );
      });

      test('a bare 429 is a rate limit even without a code', () {
        expect(
          errorMessage(l10n, const ApiException('x', statusCode: 429)),
          l10n.errorRateLimited,
        );
      });

      test('anything else is the generic message', () {
        expect(
          errorMessage(l10n, const ServerException('x')),
          l10n.errorGeneric,
        );
        expect(
          errorMessage(l10n, const UnknownException('x')),
          l10n.errorGeneric,
        );
        expect(
          errorMessage(l10n, api(418, 'SOMETHING_NEW')),
          l10n.errorGeneric,
        );
        expect(errorMessage(l10n, StateError('boom')), l10n.errorGeneric);
      });

      test('never shows the server\'s own text', () {
        for (final e in [
          api(409, 'ALREADY_APPLIED'),
          api(400, 'VALIDATION_ERROR'),
          api(418, 'UNKNOWN'),
        ]) {
          expect(errorMessage(l10n, e), isNot(contains('raw text')));
        }
      });
    });
  }
}
