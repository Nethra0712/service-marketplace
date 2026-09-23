import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/booking/application/booking_providers.dart';
import 'package:mobile/features/booking/domain/booking_repository.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';
import 'package:mobile/features/services/domain/service_category.dart';

const maxAddressLength = 500;
const maxNotesLength = 1000;

/// Request a service: on-demand now, or scheduled for a chosen time.
class ServiceRequestScreen extends ConsumerWidget {
  const ServiceRequestScreen({required this.categorySlug, super.key});

  final String categorySlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(categoryDetailProvider(categorySlug));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.serviceRequestTitle)),
      body: SafeArea(
        child: detail.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          // A service that is inactive or unknown is a 404: say so plainly
          // rather than offering a retry that can never succeed.
          error: (error, _) => error is NotFoundException
              ? EmptyView(
                  key: const Key('service_not_available'),
                  icon: Icons.block,
                  message: l10n.serviceDetailNotAvailable,
                )
              : ErrorView(
                  error: error,
                  onRetry: () =>
                      ref.invalidate(categoryDetailProvider(categorySlug)),
                ),
          data: (data) => data.cities.isEmpty
              ? EmptyView(message: l10n.serviceDetailNotAvailable)
              : _RequestForm(category: data.category, cities: data.cities),
        ),
      ),
    );
  }
}

class _RequestForm extends ConsumerStatefulWidget {
  const _RequestForm({required this.category, required this.cities});

  final ServiceCategory category;
  final List<City> cities;

  @override
  ConsumerState<_RequestForm> createState() => _RequestFormState();
}

class _RequestFormState extends ConsumerState<_RequestForm> {
  final _formKey = GlobalKey<FormState>();
  final _address = TextEditingController();
  final _notes = TextEditingController();

  late String _citySlug = widget.cities.first.slug;
  BookingType _bookingType = BookingType.onDemand;
  DateTime? _scheduledAt;
  bool _scheduledTimeTouched = false;
  bool _submitting = false;
  Object? _error;

  @override
  void dispose() {
    _address.dispose();
    _notes.dispose();
    super.dispose();
  }

  String? _validateAddress(AppLocalizations l10n, String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return l10n.serviceRequestAddressRequired;
    if (trimmed.length > maxAddressLength) {
      return l10n.serviceRequestAddressTooLong;
    }
    return null;
  }

  String? _validateNotes(AppLocalizations l10n, String? value) =>
      (value?.trim().length ?? 0) > maxNotesLength
      ? l10n.serviceRequestNotesTooLong
      : null;

  bool get _scheduledTimeValid {
    if (_bookingType == BookingType.onDemand) return true;
    final chosen = _scheduledAt;
    if (chosen == null) return false;
    return chosen.isAfter(ref.read(clockProvider)());
  }

  Future<void> _pickScheduledTime() async {
    final now = ref.read(clockProvider)();
    final initial = _scheduledAt ?? now.add(const Duration(hours: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return;
    setState(() {
      _scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
      _scheduledTimeTouched = true;
    });
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _scheduledTimeTouched = true);
    final formValid = _formKey.currentState?.validate() ?? false;
    if (!formValid || !_scheduledTimeValid) return;

    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final language = ref.read(apiLanguageProvider);
      final booking = await ref
          .read(bookingRepositoryProvider)
          .create(
            CreateBookingInput(
              categorySlug: widget.category.slug,
              citySlug: _citySlug,
              bookingType: _bookingType,
              scheduledAt: _bookingType == BookingType.scheduled
                  ? _scheduledAt
                  : null,
              serviceAddress: _address.text,
              customerNotes: _notes.text,
            ),
            language: language,
          );
      ref.invalidate(myBookingsProvider);
      messenger.showSnackBar(SnackBar(content: Text(l10n.serviceRequestSent)));
      unawaited(
        router.pushReplacement(AppRoutes.bookingDetailLocation(booking.id)),
      );
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _scheduledTimeLabel(
    AppLocalizations l10n,
    MaterialLocalizations dateFormat,
  ) {
    final chosen = _scheduledAt;
    if (chosen == null) return l10n.serviceRequestPickTime;
    final date = dateFormat.formatFullDate(chosen);
    final time = dateFormat.formatTimeOfDay(TimeOfDay.fromDateTime(chosen));
    return '$date · $time';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final error = _error;
    final dateFormat = MaterialLocalizations.of(context);

    return Form(
      key: _formKey,
      child: ListView(
        padding: AppSpacing.screen,
        children: [
          Text(
            widget.category.name,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          if (widget.cities.length > 1) ...[
            DropdownButtonFormField<String>(
              key: const Key('city_dropdown'),
              initialValue: _citySlug,
              decoration: InputDecoration(
                labelText: l10n.providerApplyCity,
                border: const OutlineInputBorder(),
              ),
              items: [
                for (final city in widget.cities)
                  DropdownMenuItem(value: city.slug, child: Text(city.name)),
              ],
              onChanged: (slug) =>
                  setState(() => _citySlug = slug ?? _citySlug),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          SegmentedButton<BookingType>(
            key: const Key('booking_type_selector'),
            segments: [
              ButtonSegment(
                value: BookingType.onDemand,
                label: Text(l10n.serviceRequestOnDemand),
                icon: const Icon(Icons.bolt_outlined),
              ),
              ButtonSegment(
                value: BookingType.scheduled,
                label: Text(l10n.serviceRequestScheduled),
                icon: const Icon(Icons.event_outlined),
              ),
            ],
            selected: {_bookingType},
            onSelectionChanged: (selected) => setState(() {
              _bookingType = selected.first;
              _scheduledTimeTouched = false;
            }),
          ),
          if (_bookingType == BookingType.scheduled) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              key: const Key('pick_scheduled_time_button'),
              onPressed: _pickScheduledTime,
              icon: const Icon(Icons.schedule),
              label: Text(_scheduledTimeLabel(l10n, dateFormat)),
            ),
            if (_scheduledTimeTouched && !_scheduledTimeValid) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.serviceRequestScheduledTimeInvalid,
                key: const Key('scheduled_time_error'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('address_field'),
            controller: _address,
            textCapitalization: TextCapitalization.sentences,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: l10n.serviceRequestAddressLabel,
              hintText: l10n.serviceRequestAddressHint,
              border: const OutlineInputBorder(),
            ),
            validator: (v) => _validateAddress(l10n, v),
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('notes_field'),
            controller: _notes,
            minLines: 2,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: l10n.serviceRequestNotesLabel,
              hintText: l10n.serviceRequestNotesHint,
              alignLabelWithHint: true,
              border: const OutlineInputBorder(),
            ),
            validator: (v) => _validateNotes(l10n, v),
          ),
          if (error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              errorMessage(l10n, error),
              key: const Key('submit_error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            key: const Key('submit_request_button'),
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.serviceRequestSubmit),
          ),
        ],
      ),
    );
  }
}
