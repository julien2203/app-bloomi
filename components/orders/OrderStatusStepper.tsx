import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { AppIcon } from '../ui/AppIcon';
import { theme } from '../../lib/theme';
import { isOrderPickupDelivery } from '../../lib/deliveryMode';

export type OrderStepperData = {
  delivery_mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
};

type StepState = 'done' | 'active' | 'upcoming';

type StepDef = {
  id: string;
  labelKey: string;
  timestamp?: string | null;
  state: StepState;
};

function formatStepDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildSteps(order: OrderStepperData, isBuyer: boolean): StepDef[] {
  const isPickup = isOrderPickupDelivery(order.delivery_mode);
  const status = String(order.status ?? '').toLowerCase();
  const paymentTransferred = String(order.payment_status ?? '').toLowerCase() === 'transferred';
  const hasLabel = Boolean(String(order.tracking_number ?? '').trim());
  const shipped = status === 'shipped' || status === 'completed' || Boolean(order.shipped_at);
  const completed = status === 'completed' || paymentTransferred;
  const confirmed = Boolean(order.confirmed_at) || completed;

  if (isPickup) {
    const paidDone = status !== 'cancelled';
    const handoffDone = confirmed || completed;
    const paidState: StepState = paidDone ? (handoffDone ? 'done' : 'active') : 'upcoming';
    const confirmState: StepState = handoffDone ? 'done' : paidDone ? 'active' : 'upcoming';
    const payoutState: StepState = completed ? 'done' : confirmState === 'done' ? 'active' : 'upcoming';

    return [
      {
        id: 'paid',
        labelKey: isBuyer ? 'profile.orders.stepper.pickupPaidBuyer' : 'profile.orders.stepper.pickupPaidSeller',
        timestamp: order.created_at,
        state: paidState === 'upcoming' && paidDone ? 'done' : paidState
      },
      {
        id: 'handoff',
        labelKey: 'profile.orders.stepper.pickupHandoff',
        state: handoffDone ? 'done' : paidDone ? 'active' : 'upcoming'
      },
      {
        id: 'confirm',
        labelKey: 'profile.orders.stepper.buyerConfirm',
        timestamp: order.confirmed_at,
        state: confirmState
      },
      {
        id: 'complete',
        labelKey: 'profile.orders.stepper.paymentReleased',
        state: payoutState
      }
    ];
  }

  const labelState: StepState = hasLabel ? 'done' : status === 'pending' ? 'active' : 'upcoming';
  const depositedState: StepState = shipped ? 'done' : hasLabel ? 'active' : 'upcoming';
  const inTransitState: StepState = shipped ? (confirmed ? 'done' : 'active') : 'upcoming';
  const receivedState: StepState = confirmed ? 'done' : shipped ? 'active' : 'upcoming';
  const completeState: StepState = completed ? 'done' : confirmed ? 'active' : 'upcoming';

  if (isBuyer) {
    return [
      {
        id: 'label',
        labelKey: 'profile.orders.stepper.labelGenerated',
        state: hasLabel ? 'done' : status === 'pending' ? 'active' : labelState
      },
      {
        id: 'deposited',
        labelKey: 'profile.orders.stepper.parcelDeposited',
        timestamp: order.shipped_at,
        state: depositedState
      },
      {
        id: 'transit',
        labelKey: 'profile.orders.stepper.parcelInTransit',
        state: inTransitState
      },
      {
        id: 'received',
        labelKey: 'profile.orders.stepper.parcelReceived',
        timestamp: order.delivered_at ?? order.confirmed_at,
        state: receivedState
      },
      {
        id: 'complete',
        labelKey: 'profile.orders.stepper.transactionComplete',
        state: completeState
      }
    ];
  }

  return [
    {
      id: 'label',
      labelKey: 'profile.orders.stepper.labelGenerated',
      state: hasLabel ? 'done' : status === 'pending' ? 'active' : labelState
    },
    {
      id: 'deposited',
      labelKey: 'profile.orders.stepper.parcelDepositedSeller',
      timestamp: order.shipped_at,
      state: depositedState
    },
    {
      id: 'transit',
      labelKey: 'profile.orders.stepper.awaitingReceipt',
      state: inTransitState
    },
    {
      id: 'confirm',
      labelKey: 'profile.orders.stepper.buyerConfirm',
      timestamp: order.confirmed_at,
      state: receivedState
    },
    {
      id: 'complete',
      labelKey: 'profile.orders.stepper.paymentReleased',
      state: completeState
    }
  ];
}

type Props = {
  order: OrderStepperData;
  isBuyer: boolean;
};

export function OrderStatusStepper({ order, isBuyer }: Props) {
  const { t } = useTranslation();
  const steps = useMemo(() => buildSteps(order, isBuyer), [order, isBuyer]);

  return (
    <View style={styles.wrap}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const ts = formatStepDate(step.timestamp);
        return (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.railCol}>
              <View
                style={[
                  styles.dot,
                  step.state === 'done' && styles.dotDone,
                  step.state === 'active' && styles.dotActive
                ]}
              >
                {step.state === 'done' ? (
                  <AppIcon name="checkCircleBold" size={16} color="#15803D" />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    step.state === 'done' ? styles.lineDone : styles.lineUpcoming
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.stepContent}>
              <Text
                variant="body"
                style={[
                  styles.stepLabel,
                  step.state === 'active' && styles.stepLabelActive,
                  step.state === 'upcoming' && styles.stepLabelUpcoming
                ]}
              >
                {t(step.labelKey)}
              </Text>
              {ts ? (
                <Text variant="captionSm" color="textSecondary">
                  {ts}
                </Text>
              ) : step.state === 'active' ? (
                <Text variant="captionSm" color="textSecondary">
                  {t('profile.orders.stepper.inProgress')}
                </Text>
              ) : step.state === 'upcoming' ? (
                <Text variant="captionSm" color="textSecondary">
                  {t('profile.orders.stepper.pending')}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 56
  },
  railCol: {
    width: 28,
    alignItems: 'center'
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dotDone: {
    borderColor: '#15803D',
    backgroundColor: '#DCFCE7'
  },
  dotActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F4FBE8'
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2
  },
  lineDone: {
    backgroundColor: '#86EFAC'
  },
  lineUpcoming: {
    backgroundColor: theme.colors.border
  },
  stepContent: {
    flex: 1,
    paddingBottom: 16,
    paddingLeft: 8,
    gap: 2
  },
  stepLabel: {
    fontWeight: '600'
  },
  stepLabelActive: {
    color: theme.colors.textPrimary
  },
  stepLabelUpcoming: {
    color: theme.colors.textSecondary
  }
});
