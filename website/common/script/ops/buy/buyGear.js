import content from '../../content/index';
import i18n from '../../i18n';
import get from 'lodash/get';
import pick from 'lodash/pick';
import splitWhitespace from '../../libs/splitWhitespace';
import {
  BadRequest,
  NotAuthorized,
  NotFound,
} from '../../libs/errors';
import handleTwoHanded from '../../fns/handleTwoHanded';
import ultimateGear from '../../fns/ultimateGear';

import { removePinnedGearAddPossibleNewOnes } from '../pinnedGearUtils';

module.exports = function buyGear (user, req = {}, analytics) {
  let key = get(req, 'params.key');
  if (!key) throw new BadRequest(i18n.t('missingKeyParam', req.language));

  let item = content.gear.flat[key];

  if (!item) throw new NotFound(i18n.t('itemNotFound', {key}, req.language));

  if (user.stats.gp < item.value) {
    throw new NotAuthorized(i18n.t('messageNotEnoughGold', req.language));
  }

  if (item.canOwn && !item.canOwn(user)) {
    throw new NotAuthorized(i18n.t('cannotBuyItem', req.language));
  }

  let message;

  if (user.items.gear.owned[item.key]) {
    throw new NotAuthorized(i18n.t('equipmentAlreadyOwned', req.language));
  }

  let itemIndex = Number(item.index);

  if (Number.isInteger(itemIndex) && content.classes.includes(item.klass)) {
    let previousLevelGear = key.replace(/[0-9]/, itemIndex - 1);
    let hasPreviousLevelGear = user.items.gear.owned[previousLevelGear];
    let checkIndexToType = itemIndex > (item.type === 'weapon' || item.type === 'shield' && item.klass === 'rogue' ? 0 : 1);

    if (checkIndexToType && !hasPreviousLevelGear) {
      throw new NotAuthorized(i18n.t('previousGearNotOwned', req.language));
    }
  }

  if (user.preferences.autoEquip) {
    user.items.gear.equipped[item.type] = item.key;
    message = handleTwoHanded(user, item, undefined, req);
  }

  removePinnedGearAddPossibleNewOnes(user, `gear.flat.${item.key}`, item.key);

  if (item.last) ultimateGear(user);

  user.stats.gp -= item.value;

  if (!message) {
    message = i18n.t('messageBought', {
      itemText: item.text(req.language),
    }, req.language);
  }

  if (analytics) {
    analytics.track('acquire item', {
      uuid: user._id,
      itemKey: key,
      acquireMethod: 'Gold',
      goldCost: item.value,
      category: 'behavior',
      headers: req.headers,
    });
  }

  return [
    pick(user, splitWhitespace('items achievements stats flags pinnedItems')),
    message,
  ];
};
