package Game::Actions::Map;
use strict;
use warnings;

use Game::Actions;
use Game::Constants::Map;
use Game::Environment qw(init_user_by_sid :std :db :response);
use Game::Model::Map;
use Game::Model::Region;
use Exporter::Easy ( OK => [qw(createDefaultMaps
                               getMapList
                               getMapInfo
                               uploadMap)] );


sub createDefaultMaps {
    my $i = 1;
    eval {
        for my $map (@Game::Constants::Map::maps) {
            my $n_map = db_search_one({ name => $map->{name} },
                                      { CLASS => 'Game::Model::Map'});
            db()->delete($n_map) if defined $n_map;
            $n_map = Game::Model::Map->construct_from_state($map);
            $n_map->init_id();
            db()->insert_nonroot($n_map);
            ++$i;
        }
    };
    response_json({result => 'ok'});
}

sub getMapList {
    my @q = grep { defined $_->id() }
        db_search({ CLASS => 'Game::Model::Map' })->all();
    my @maps = feature('durty_gameList') ?
        map { $_->extract_state_durty() } @q :
        map { $_->short_info()    } @q;
    response_json({result => 'ok', maps => \@maps});
}

sub getMapInfo {
    my ($data) = @_;
    my ($map, $err);
    if (defined $data->{mapId}) {
        $map = db_search_one({ id => $data->{mapId} },
                             { CLASS => 'Game::Model::Map' });
        $err = 'badMapId'
    } elsif (defined $data->{mapName}) {
        $map = db_search_one({ mapName => $data->{mapName} },
                             { CLASS => 'Game::Model::Map' });
        $err = 'badMapName'
    } elsif (defined $data->{sid}) {
        init_user_by_sid($data->{sid});
        $map = global_game()->map();
        $err = 'notInGame'
    } else {
        $err = 'badJson'
    }
    assert($map, $err);
    response_json({ result => 'ok',
                    mapInfo => $map->full_info() });
}

sub uploadMap {
    my ($data) = @_;
    proto($data, 'mapName', 'playersNum', 'turnsNum', 'regions');

    my $map = db_search_one({ mapName => $data->{mapName} },
                            { CLASS => 'Game::Model::Map' });
    if ($map) {
        early_response_json({ result => 'mapNameTaken' })
    }

    my @regions;
    for my $i (0 .. $#{$data->{regions}}) {
        my $reg = eval {
            Game::Model::Region->new($data->{regions}[$i]);
        };
        if ($@) {
            if (ref($@) eq 'Game::Exception::EarlyResponse' ) {
                die $@
            } else {
                early_response_json({result => 'badRegions', num => $i})
            }
        }
        push @regions, $reg
    }

    $map = Game::Model::Map->new(
               params_from_proto('mapName', 'playersNum', 'turnsNum'),
               regions => \@regions
           );
    $map->init_id();
    db()->insert_nonroot($map);
    response_json({result => 'ok', mapId => $map->id()});
}



1;
