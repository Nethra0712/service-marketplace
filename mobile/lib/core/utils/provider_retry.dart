/// Riverpod retries a failed provider automatically, with growing delays. For
/// screens that show an error with a "Try again" button that is unwanted: the
/// person is in control, and a permanent failure (a 404, say) must not be
/// requested again and again in the background.
///
/// Pass as `retry:` when declaring a provider.
Duration? noAutomaticRetry(int retryCount, Object error) => null;
