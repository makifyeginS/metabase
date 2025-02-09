import { useCallback, useMemo } from "react";

import AccordionList from "metabase/core/components/AccordionList";
import { getColumnIcon } from "metabase/common/utils/columns";
import { Icon, IconName } from "metabase/core/components/Icon";
import { singularize } from "metabase/lib/formatting";

import * as Lib from "metabase-lib";

import {
  BinningStrategyPickerPopover,
  TemporalBucketPickerPopover,
} from "./BucketPickerPopover";

const DEFAULT_MAX_HEIGHT = 610;

type ColumnListItem = Lib.ColumnDisplayInfo & {
  column: Lib.ColumnMetadata;
};

export interface QueryColumnPickerProps {
  className?: string;
  query: Lib.Query;
  stageIndex: number;
  columnGroups: Lib.ColumnGroup[];
  hasBinning?: boolean;
  hasTemporalBucketing?: boolean;
  maxHeight?: number;
  checkIsColumnSelected: (item: ColumnListItem) => boolean;
  onSelect: (column: Lib.ColumnMetadata) => void;
  onClose?: () => void;
}

type Sections = {
  name: string;
  items: ColumnListItem[];
  icon?: IconName;
};

function QueryColumnPicker({
  className,
  query,
  stageIndex,
  columnGroups,
  hasBinning = false,
  hasTemporalBucketing = false,
  maxHeight = DEFAULT_MAX_HEIGHT,
  checkIsColumnSelected,
  onSelect,
  onClose,
}: QueryColumnPickerProps) {
  const sections: Sections[] = useMemo(
    () =>
      columnGroups.map(group => {
        const groupInfo = Lib.displayInfo(query, stageIndex, group);

        const items = Lib.getColumnsFromColumnGroup(group).map(column => ({
          ...Lib.displayInfo(query, stageIndex, column),
          column,
        }));

        return {
          name: getGroupName(groupInfo),
          icon: getGroupIcon(groupInfo),
          items,
        };
      }),
    [query, stageIndex, columnGroups],
  );

  const handleSelect = useCallback(
    (column: Lib.ColumnMetadata) => {
      onSelect(column);
      onClose?.();
    },
    [onSelect, onClose],
  );

  const handleSelectColumn = useCallback(
    (item: ColumnListItem) => {
      const isSameColumn = checkIsColumnSelected(item);

      if (isSameColumn) {
        onClose?.();
        return;
      }

      const isBinned = Lib.binning(item.column) != null;
      const isBinnable =
        isBinned || Lib.isBinnable(query, stageIndex, item.column);

      if (hasBinning && isBinnable) {
        const column = isBinned
          ? item.column
          : Lib.withDefaultBinning(query, stageIndex, item.column);
        handleSelect(column);
        return;
      }

      const isBucketed = Lib.temporalBucket(item.column) != null;
      const isBucketable =
        isBucketed || Lib.isTemporalBucketable(query, stageIndex, item.column);

      if (hasTemporalBucketing && isBucketable) {
        const column = isBucketed
          ? item.column
          : Lib.withDefaultTemporalBucket(query, stageIndex, item.column);
        handleSelect(column);
        return;
      }

      handleSelect(item.column);
    },
    [
      query,
      stageIndex,
      hasBinning,
      hasTemporalBucketing,
      checkIsColumnSelected,
      handleSelect,
      onClose,
    ],
  );

  const renderItemExtra = useCallback(
    (item: ColumnListItem) => {
      if (hasBinning && Lib.isBinnable(query, stageIndex, item.column)) {
        const buckets = Lib.availableBinningStrategies(
          query,
          stageIndex,
          item.column,
        );
        const isEditing = checkIsColumnSelected(item);
        return (
          <BinningStrategyPickerPopover
            query={query}
            stageIndex={stageIndex}
            column={item.column}
            buckets={buckets}
            isEditing={isEditing}
            onSelect={handleSelect}
          />
        );
      }

      if (
        hasTemporalBucketing &&
        Lib.isTemporalBucketable(query, stageIndex, item.column)
      ) {
        const buckets = Lib.availableTemporalBuckets(
          query,
          stageIndex,
          item.column,
        );
        const isEditing = checkIsColumnSelected(item);
        return (
          <TemporalBucketPickerPopover
            query={query}
            stageIndex={stageIndex}
            column={item.column}
            buckets={buckets}
            isEditing={isEditing}
            onSelect={handleSelect}
          />
        );
      }

      return null;
    },
    [
      query,
      stageIndex,
      hasBinning,
      hasTemporalBucketing,
      checkIsColumnSelected,
      handleSelect,
    ],
  );

  return (
    <AccordionList
      className={className}
      sections={sections}
      maxHeight={maxHeight}
      alwaysExpanded={false}
      onChange={handleSelectColumn}
      itemIsSelected={checkIsColumnSelected}
      renderItemName={renderItemName}
      renderItemDescription={omitItemDescription}
      renderItemIcon={renderItemIcon}
      renderItemExtra={renderItemExtra}
      // Compat with E2E tests around MLv1-based components
      // Prefer using a11y role selectors
      itemTestId="dimension-list-item"
    />
  );
}

function renderItemName(item: ColumnListItem) {
  return item.displayName;
}

function omitItemDescription() {
  return null;
}

function renderItemIcon(item: ColumnListItem) {
  return <Icon name={getColumnIcon(item.column)} size={18} />;
}

function getGroupName(groupInfo: Lib.ColumnDisplayInfo | Lib.TableDisplayInfo) {
  const columnInfo = groupInfo as Lib.ColumnDisplayInfo;
  const tableInfo = groupInfo as Lib.TableDisplayInfo;
  return columnInfo.fkReferenceName || singularize(tableInfo.displayName);
}

function getGroupIcon(groupInfo: Lib.ColumnDisplayInfo | Lib.TableDisplayInfo) {
  if ((groupInfo as Lib.TableDisplayInfo).isSourceTable) {
    return "table";
  }
  if (groupInfo.isFromJoin) {
    return "join_left_outer";
  }
  if (groupInfo.isImplicitlyJoinable) {
    return "connections";
  }
  return;
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default QueryColumnPicker;
